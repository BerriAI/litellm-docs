// Native transparent HEVC export for Safari. Requires macOS 13 or later.
// Compile with: swiftc -O -parse-as-library encode-video.swift -o encode-video
// Usage: encode-video <framesDir> <output.mov> [fps=25] [count=400] [bitrate=6000000]
// PNGs are numbered 0000.png, 0001.png, ... and retain their source dimensions.

import Foundation
import AVFoundation
import CoreVideo
import CoreGraphics
import ImageIO
import VideoToolbox

struct ExportFailure: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}

func progress(_ message: String) {
    FileHandle.standardError.write(Data((message + "\n").utf8))
}

func readImage(_ url: URL) throws -> CGImage {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw ExportFailure("Cannot read PNG: \(url.path)")
    }
    return image
}

func fill(_ buffer: CVPixelBuffer, from image: CGImage) throws {
    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    let width = CVPixelBufferGetWidth(buffer), height = CVPixelBufferGetHeight(buffer)
    guard image.width == width, image.height == height,
          let base = CVPixelBufferGetBaseAddress(buffer),
          let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
          let context = CGContext(data: base, width: width, height: height,
                                  bitsPerComponent: 8,
                                  bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
                                  space: colorSpace,
                                  bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue |
                                    CGImageAlphaInfo.premultipliedFirst.rawValue) else {
        throw ExportFailure("Cannot create a BGRA drawing context, or source dimensions changed")
    }
    context.clear(CGRect(x: 0, y: 0, width: width, height: height))
    context.setBlendMode(.copy)
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    CVBufferSetAttachment(buffer, kCVImageBufferAlphaChannelModeKey,
                          kCVImageBufferAlphaChannelMode_PremultipliedAlpha, .shouldPropagate)
}

func inspect(_ url: URL, expectedFrames: Int, fps: Int) async throws -> [String: Any] {
    let asset = AVURLAsset(url: url)
    guard let track = try await asset.loadTracks(withMediaType: .video).first else {
        throw ExportFailure("Encoded movie has no video track")
    }
    let formats = try await track.load(.formatDescriptions)
    let containsAlpha = try await track.load(.mediaCharacteristics).contains(.containsAlphaChannel)
    guard containsAlpha else { throw ExportFailure("HEVC export does not advertise an alpha channel") }
    let duration = try await asset.load(.duration)
    let reader = try AVAssetReader(asset: asset)
    let output = AVAssetReaderTrackOutput(track: track, outputSettings: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    ])
    output.alwaysCopiesSampleData = false
    guard reader.canAdd(output) else { throw ExportFailure("Cannot decode HEVC alpha for verification") }
    reader.add(output)
    guard reader.startReading() else { throw ExportFailure("Cannot start native decode: \(String(describing: reader.error))") }
    var frames = 0, transparent = 0, partial = 0, opaque = 0
    while let sample = output.copyNextSampleBuffer() {
        guard let buffer = CMSampleBufferGetImageBuffer(sample) else {
            throw ExportFailure("Decoded frame has no image buffer")
        }
        if frames == 0 {
            CVPixelBufferLockBaseAddress(buffer, .readOnly)
            if let pointer = CVPixelBufferGetBaseAddress(buffer)?.assumingMemoryBound(to: UInt8.self) {
                let stride = CVPixelBufferGetBytesPerRow(buffer)
                for y in 0..<CVPixelBufferGetHeight(buffer) {
                    for x in 0..<CVPixelBufferGetWidth(buffer) {
                        let alpha = pointer[y * stride + x * 4 + 3]
                        if alpha == 0 { transparent += 1 }
                        else if alpha == 255 { opaque += 1 }
                        else { partial += 1 }
                    }
                }
            }
            CVPixelBufferUnlockBaseAddress(buffer, .readOnly)
        }
        frames += 1
    }
    guard reader.status == .completed else { throw ExportFailure("Native decode failed: \(String(describing: reader.error))") }
    guard frames == expectedFrames else { throw ExportFailure("Decoded \(frames) frames, expected \(expectedFrames)") }
    guard abs(duration.seconds - Double(expectedFrames) / Double(fps)) < 0.001 else {
        throw ExportFailure("Movie duration differs from source timing")
    }
    guard transparent > 0, partial > 0 else {
        throw ExportFailure("Decoded movie did not preserve transparent and partially transparent pixels")
    }
    let subtype = formats.first.map { CMFormatDescriptionGetMediaSubType($0) } ?? 0
    let codec = String(bytes: [UInt8((subtype >> 24) & 255), UInt8((subtype >> 16) & 255),
                              UInt8((subtype >> 8) & 255), UInt8(subtype & 255)], encoding: .ascii) ?? "unknown"
    return ["codec": codec, "contains_alpha": containsAlpha, "decoded_frames": frames,
            "duration_seconds": duration.seconds, "first_frame_transparent_pixels": transparent,
            "first_frame_partial_alpha_pixels": partial, "first_frame_opaque_pixels": opaque]
}

@main
struct Main {
    static func main() async {
        do {
            let arguments = CommandLine.arguments
            guard arguments.count >= 3 else {
                throw ExportFailure("Usage: encode-video <framesDir> <output.mov> [fps=25] [count=400] [bitrate=6000000]")
            }
            let framesDirectory = URL(fileURLWithPath: arguments[1], isDirectory: true)
            let destination = URL(fileURLWithPath: arguments[2])
            let fps = arguments.count > 3 ? Int(arguments[3]) ?? 0 : 25
            let count = arguments.count > 4 ? Int(arguments[4]) ?? 0 : 400
            let bitrate = arguments.count > 5 ? Int(arguments[5]) ?? 0 : 6_000_000
            guard fps > 0, count > 0, bitrate > 0 else { throw ExportFailure("fps, count, and bitrate must be positive") }
            let first = try readImage(framesDirectory.appendingPathComponent("0000.png"))
            let width = first.width, height = first.height
            let files = (0..<count).map { framesDirectory.appendingPathComponent(String(format: "%04d.png", $0)) }
            guard files.allSatisfy({ FileManager.default.fileExists(atPath: $0.path) }) else {
                throw ExportFailure("Source frame sequence is incomplete")
            }
            try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
            let pending = destination.deletingLastPathComponent().appendingPathComponent(".\(destination.lastPathComponent).pending.mov")
            try? FileManager.default.removeItem(at: pending)
            let writer = try AVAssetWriter(outputURL: pending, fileType: .mov)
            writer.shouldOptimizeForNetworkUse = true
            let settings: [String: Any] = [
                AVVideoCodecKey: AVVideoCodecType.hevcWithAlpha,
                AVVideoWidthKey: width, AVVideoHeightKey: height,
                AVVideoCompressionPropertiesKey: [
                    AVVideoAverageBitRateKey: bitrate,
                    AVVideoExpectedSourceFrameRateKey: fps,
                    AVVideoMaxKeyFrameIntervalKey: fps * 2,
                    kVTCompressionPropertyKey_TargetQualityForAlpha as String: 0.9,
                ],
            ]
            guard writer.canApply(outputSettings: settings, forMediaType: .video) else {
                throw ExportFailure("This macOS encoder cannot apply HEVC-with-alpha settings")
            }
            let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
            input.expectsMediaDataInRealTime = false
            let attributes: [String: Any] = [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
                kCVPixelBufferWidthKey as String: width,
                kCVPixelBufferHeightKey as String: height,
                kCVPixelBufferCGImageCompatibilityKey as String: true,
                kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
            ]
            let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: attributes)
            guard writer.canAdd(input) else { throw ExportFailure("Cannot attach HEVC-with-alpha input") }
            writer.add(input)
            guard writer.startWriting() else { throw ExportFailure("Cannot start HEVC encoder: \(String(describing: writer.error))") }
            writer.startSession(atSourceTime: .zero)
            for index in 0..<count {
                while !input.isReadyForMoreMediaData {
                    guard writer.status == .writing else { throw ExportFailure("HEVC encoder failed: \(String(describing: writer.error))") }
                    try await Task.sleep(for: .milliseconds(2))
                }
                try autoreleasepool {
                    var pixelBuffer: CVPixelBuffer?
                    let status: CVReturn
                    if let pool = adaptor.pixelBufferPool {
                        status = CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &pixelBuffer)
                    } else {
                        status = CVPixelBufferCreate(kCFAllocatorDefault, width, height, kCVPixelFormatType_32BGRA,
                                                    attributes as CFDictionary, &pixelBuffer)
                    }
                    guard status == kCVReturnSuccess, let buffer = pixelBuffer else {
                        throw ExportFailure("Cannot allocate BGRA frame: \(status)")
                    }
                    try fill(buffer, from: readImage(files[index]))
                    guard adaptor.append(buffer, withPresentationTime: CMTime(value: Int64(index), timescale: Int32(fps))) else {
                        throw ExportFailure("Cannot append HEVC frame \(index): \(String(describing: writer.error))")
                    }
                }
                if index % 50 == 0 { progress("HEVC alpha: \(index + 1)/\(count) frames") }
            }
            writer.endSession(atSourceTime: CMTime(value: Int64(count), timescale: Int32(fps)))
            input.markAsFinished()
            await writer.finishWriting()
            guard writer.status == .completed else { throw ExportFailure("HEVC export failed: \(String(describing: writer.error))") }
            var report = try await inspect(pending, expectedFrames: count, fps: fps)
            if FileManager.default.fileExists(atPath: destination.path) { try FileManager.default.removeItem(at: destination) }
            try FileManager.default.moveItem(at: pending, to: destination)
            report["path"] = destination.path; report["width"] = width; report["height"] = height
            report["fps"] = fps; report["bitrate_target"] = bitrate; report["alpha_quality"] = 0.9
            report["bytes"] = try destination.resourceValues(forKeys: [.fileSizeKey]).fileSize
            let json = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
            print(String(decoding: json, as: UTF8.self))
        } catch {
            progress("HEVC export error: \(error)")
            exit(1)
        }
    }
}

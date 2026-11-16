import type { NetworkDiagram } from './networkTypes';

// A dot is a connection. At every other crossing, the horizontal path bridges
// a small gap in the vertical path so unrelated traffic never looks connected.
export function routeNetworkEdges(diagram: NetworkDiagram): string[] {
  const segments = diagram.edges.flatMap((edge, edgeIndex) => edge.points.slice(1).map((end, index) => ({
    start: edge.points[index], end, edgeIndex,
  })));
  const crossings: [number, number][] = [];
  for (const horizontal of segments) {
    if (horizontal.start[1] !== horizontal.end[1]) continue;
    for (const vertical of segments) {
      if (vertical.start[0] !== vertical.end[0] || horizontal.edgeIndex === vertical.edgeIndex) continue;
      const x = vertical.start[0], y = horizontal.start[1];
      if (x <= Math.min(horizontal.start[0], horizontal.end[0]) + 7 || x >= Math.max(horizontal.start[0], horizontal.end[0]) - 7) continue;
      if (y <= Math.min(vertical.start[1], vertical.end[1]) + 7 || y >= Math.max(vertical.start[1], vertical.end[1]) - 7) continue;
      if (diagram.junctions?.some(junction => junction.x === x && junction.y === y)) continue;
      if (!crossings.some(point => point[0] === x && point[1] === y)) crossings.push([x, y]);
    }
  }

  return diagram.edges.map(edge => {
    let path = `M${edge.points[0].join(',')}`;
    for (let index = 1; index < edge.points.length; index++) {
      const start = edge.points[index - 1], end = edge.points[index];
      const horizontal = start[1] === end[1];
      const axis = horizontal ? 0 : 1;
      const direction = Math.sign(end[axis] - start[axis]);
      const bridges = crossings.filter(point => point[1 - axis] === start[1 - axis]
        && point[axis] > Math.min(start[axis], end[axis]) && point[axis] < Math.max(start[axis], end[axis]))
        .sort((a, b) => direction * (a[axis] - b[axis]));
      for (const [x, y] of bridges) {
        path += horizontal
          ? ` L${x - direction * 6},${y} Q${x},${y - 12} ${x + direction * 6},${y}`
          : ` L${x},${y - direction * 8} M${x},${y + direction * 8}`;
      }
      path += ` L${end.join(',')}`;
    }
    return path;
  });
}

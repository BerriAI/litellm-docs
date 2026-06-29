// Minimal benchmark for LiteLLM Rust gateway forwarding overhead.
// Modes:
//   bench mock           -> mock upstream on 127.0.0.1:9001 (instant fixed JSON)
//   bench gateway        -> thin forwarding gateway on 127.0.0.1:9000 (light transform + forward to mock)
//   bench bench URL N C  -> closed-loop load, N requests, C concurrency; prints p50,p90,p95,p99,rps (ms)
use std::env;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Instant;

use axum::{extract::State, http::StatusCode, routing::post, Json, Router};
use serde_json::{json, Value};
use tokio::sync::Mutex;

async fn mock_responses(Json(_body): Json<Value>) -> Json<Value> {
    Json(json!({
        "id": "resp_mock",
        "object": "response",
        "output": [{"type":"message","role":"assistant","content":[{"type":"output_text","text":"ok"}]}],
        "usage": {"input_tokens": 12, "output_tokens": 6, "total_tokens": 18}
    }))
}

// OpenAI-compatible chat completion, so the real LiteLLM proxy can forward to this mock.
async fn mock_chat(Json(_body): Json<Value>) -> Json<Value> {
    Json(json!({
        "id": "chatcmpl-mock",
        "object": "chat.completion",
        "created": 1,
        "model": "mock",
        "choices": [{"index":0,"message":{"role":"assistant","content":"ok"},"finish_reason":"stop"}],
        "usage": {"prompt_tokens": 12, "completion_tokens": 6, "total_tokens": 18}
    }))
}

async fn gw_chat(
    State(client): State<Arc<reqwest::Client>>,
    Json(mut body): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    if let Some(obj) = body.as_object_mut() {
        obj.insert("litellm_transformed".to_string(), Value::Bool(true));
    }
    let resp = client
        .post("http://127.0.0.1:9001/v1/chat/completions")
        .json(&body)
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;
    let out: Value = resp.json().await.map_err(|_| StatusCode::BAD_GATEWAY)?;
    Ok(Json(out))
}

async fn gw_handler(
    State(client): State<Arc<reqwest::Client>>,
    Json(mut body): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    // Light request transform, representative of the Rust core's work.
    if let Some(obj) = body.as_object_mut() {
        obj.insert("litellm_transformed".to_string(), Value::Bool(true));
    }
    let resp = client
        .post("http://127.0.0.1:9001/v1/responses")
        .json(&body)
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;
    let out: Value = resp.json().await.map_err(|_| StatusCode::BAD_GATEWAY)?;
    Ok(Json(out))
}

async fn run_mock() {
    let app = Router::new()
        .route("/v1/responses", post(mock_responses))
        .route("/v1/chat/completions", post(mock_chat))
        .route("/chat/completions", post(mock_chat));
    let l = tokio::net::TcpListener::bind("127.0.0.1:9001").await.unwrap();
    axum::serve(l, app).await.unwrap();
}

async fn run_gateway() {
    let client = reqwest::Client::builder()
        .pool_max_idle_per_host(256)
        .build()
        .unwrap();
    let app = Router::new()
        .route("/v1/responses", post(gw_handler))
        .route("/v1/chat/completions", post(gw_chat))
        .with_state(Arc::new(client));
    let l = tokio::net::TcpListener::bind("127.0.0.1:9000").await.unwrap();
    axum::serve(l, app).await.unwrap();
}

async fn run_bench(url: String, total: usize, conc: usize) {
    let client = reqwest::Client::builder()
        .pool_max_idle_per_host(conc * 4)
        .build()
        .unwrap();
    let text = "Summarize the following text in one sentence: the quick brown fox jumps over the lazy dog near the river bank at dawn.";
    let payload = if url.contains("chat/completions") {
        json!({"model": "mock", "messages": [{"role": "user", "content": text}]})
    } else {
        json!({"model": "openai/gpt-4o-mini", "input": text})
    };
    let counter = Arc::new(AtomicUsize::new(0));
    let lat = Arc::new(Mutex::new(Vec::<u64>::with_capacity(total)));
    let start = Instant::now();
    let mut handles = Vec::new();
    for _ in 0..conc {
        let client = client.clone();
        let url = url.clone();
        let payload = payload.clone();
        let counter = counter.clone();
        let lat = lat.clone();
        handles.push(tokio::spawn(async move {
            let mut local = Vec::new();
            loop {
                let i = counter.fetch_add(1, Ordering::Relaxed);
                if i >= total {
                    break;
                }
                let t = Instant::now();
                let r = client
                    .post(&url)
                    .header("authorization", "Bearer sk-1234")
                    .json(&payload)
                    .send()
                    .await;
                if let Ok(resp) = r {
                    let _ = resp.bytes().await;
                }
                local.push(t.elapsed().as_nanos() as u64);
            }
            lat.lock().await.extend(local);
        }));
    }
    for h in handles {
        let _ = h.await;
    }
    let wall = start.elapsed().as_secs_f64();
    let mut v = Arc::try_unwrap(lat).unwrap().into_inner();
    v.sort_unstable();
    let pct = |p: f64| -> f64 {
        let idx = (((v.len() as f64) * p) as usize).min(v.len() - 1);
        v[idx] as f64 / 1e6
    };
    let rps = total as f64 / wall;
    println!(
        "{:.5},{:.5},{:.5},{:.5},{:.1}",
        pct(0.50),
        pct(0.90),
        pct(0.95),
        pct(0.99),
        rps
    );
}

#[tokio::main(flavor = "multi_thread")]
async fn main() {
    let args: Vec<String> = env::args().collect();
    match args.get(1).map(|s| s.as_str()).unwrap_or("") {
        "mock" => run_mock().await,
        "gateway" => run_gateway().await,
        "bench" => {
            let url = args[2].clone();
            let total: usize = args[3].parse().unwrap();
            let conc: usize = args[4].parse().unwrap();
            run_bench(url, total, conc).await;
        }
        other => {
            eprintln!("unknown mode: {}", other);
            std::process::exit(2);
        }
    }
}

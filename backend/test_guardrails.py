import backend.observability as obs
from backend.security import mask_pii


def test_mask_pii_masks_employee_ids_and_financial_data(tmp_path, monkeypatch):
    text = "Employee ID 123456 and SSN 123-45-6789 and card 4111-1111-1111-1111"
    redacted = mask_pii(text)

    assert "[REDACTED SSN]" in redacted
    assert "[REDACTED CARD]" in redacted
    assert "[REDACTED PERSONNEL_ID]" in redacted


def test_analytics_summary_tracks_today_queries(tmp_path, monkeypatch):
    analytics_path = tmp_path / "analytics.json"
    monkeypatch.setattr(obs, "ANALYTICS_FILE", str(analytics_path))
    obs.analytics_db = {
        "queries_count": 10,
        "queries_by_day": {"2024-01-01": 10},
        "unanswered_queries": [],
        "total_tokens": 0,
        "total_cost": 0.0,
        "latencies": {
            "retrieval": [],
            "rerank": [],
            "generation": [],
            "nli": []
        },
        "rag_triad": {
            "context_precision": 0.94,
            "faithfulness": 0.91,
            "answer_relevance": 0.95
        }
    }
    obs.save_analytics()

    obs.track_query("Q1 update", unanswered=False, tokens=5, cost=0.25)
    summary = obs.get_analytics_summary()

    assert summary["queries_today"] == 1
    assert summary["total_cost"] == 0.25

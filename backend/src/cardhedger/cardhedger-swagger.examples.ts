/** Card Hedge Swagger Try it out 기본값 (api-1.json + 로컬 fixtures) */
import { SWAGGER_FIXTURES } from '../swagger/fixtures';

export const CARDHEDGER_SWAGGER_EXAMPLES = {
  post_v1_cards_card_search: {
    "search": "Pikachu",
    "category": "Pokemon",
    "page": 1,
    "page_size": 10
  },
  post_v1_cards_card_match: {
    "query": "2023 Pokemon SV 151 Pikachu #173 PSA 10",
    "category": "Pokemon",
    "max_candidates": 5
  },
  post_v1_cards_set_search: {
    "search": "Pokemon 151",
    "count": 10
  },
  post_v1_cards_search_cards_wsort: {
    "search": "Pikachu",
    "category": "Pokemon",
    "page": 1,
    "page_size": 10
  },
  post_v1_cards_card_details: {
    "card_id": "1586812246197x228181943611293700"
  },
  post_v1_cards_prices_by_cert: {
    "cert": SWAGGER_FIXTURES.certNumber,
    "grader": "PSA"
  },
  post_v1_cards_batch_prices_by_cert: {
    "certs": [
      SWAGGER_FIXTURES.certNumber,
      "76676185"
    ],
    "grader": "PSA"
  },
  post_v1_cards_prices_by_cert_ocr: {
    "image_url": "https://example.com/graded-card.jpg",
    "days": 180
  },
  post_v1_cards_details_by_cert_ocr: {
    "image_url": "https://example.com/graded-card.jpg"
  },
  post_v1_cards_details_by_certs: {
    "certs": [
      SWAGGER_FIXTURES.certNumber,
      "76676185"
    ],
    "grader": "PSA"
  },
  post_v1_cards_prices_by_card: {
    "card_id": "1586812246197x228181943611293700",
    "grade": "PSA 10"
  },
  post_v1_cards_comps: {
    "card_id": "1587446850514x224832321163624450",
    "count": 10,
    "grade": "PSA 9"
  },
  post_v1_cards_all_prices_by_card: {
    "card_id": "1586812246197x228181943611293700"
  },
  post_v1_cards_90day_prices_by_grade: {
    "page": 1,
    "page_size": 20,
    "grade": "PSA 10"
  },
  post_v1_cards_card_request: {
    "player": "River",
    "set": "2020 Panini Illusions",
    "card_number": "44",
    "subset": "",
    "image_url": "https://i.ebayimg.com/images/g/LssAAOSwjl9h2Q16/s-l1600.jpg",
    "external_id": "RiverTest1",
    "token": "your-client-id",
    "variant": "Blue"
  },
  post_v1_cards_price_updates: {
    "since": "2024-01-01T00:00:00.000Z"
  },
  post_v1_cards_price_estimate: {
    "card_id": "1586812246197x228181943611293700",
    "grade": "PSA 10"
  },
  post_v1_cards_batch_price_estimate: {
    "items": [
      {
        "card_id": "1586812246197x228181943611293700",
        "grade": "PSA 10"
      },
      {
        "card_id": "1586812246197x228181943611293700",
        "grade": "PSA 9"
      }
    ]
  },
  post_v1_cards_card_fmv: {
    "card_id": "1586812246197x228181943611293700",
    "grade": "PSA 10"
  },
  post_v1_cards_card_fmv_batch: {
    "items": [
      {
        "card_id": "1586812246197x228181943611293700",
        "grade": "PSA 10"
      },
      {
        "card_id": "1586812246197x228181943611293700",
        "grade": "PSA 9"
      }
    ]
  },
  post_v1_cards_fmv_by_cert: {
    "cert": SWAGGER_FIXTURES.certNumber,
    "grader": "PSA"
  },
  post_v1_cards_subscribe_price_updates: {
    "client_id": "your_client_id",
    "subscriptions": [
      {
        "card_id": "1586812246197x228181943611293700",
        "grade": "PSA 10",
        "external_id": "test_123"
      },
      {
        "card_id": "1699670576265x928796749151534600",
        "grade": "PSA 9"
      }
    ]
  },
  post_v1_cards_90day_prices_by_grade_search: {
    "search": "Pikachu 151",
    "grade": "PSA 10"
  },
  post_v1_cards_additions_summary: {
    "start_date": "2026-03-01"
  },
  post_v1_cards_total_sales_by_player: {
    "players": [
      "Mike Trout"
    ],
    "days": 30
  },
  post_v1_cards_sales_stats_by_player: {
    "players": [
      "Mike Trout"
    ],
    "interval": "week",
    "periods": 12
  },
  post_v1_cards_image_search: {
    "image_url": "https://example.com/card.jpg",
    "k": 10
  },
  post_v1_cards_image_match: {
    "image_url": "https://example.com/card.jpg",
    "k": 10
  },
  post_v1_cards_issues: {
    "card_id": "1587446850514x224832321163624450",
    "card_title": "2018 Topps Chrome Shohei Ohtani #150 Refractor",
    "issue_description": "PSA 10 price showing $250 but recent comps are consistently $2,500+"
  },
} as const;

export const CARDHEDGER_QUERY_EXAMPLES = {
  count: 10,
  category: 'Pokemon',
  status: 'new',
} as const;

export const CARDHEDGER_PATH_EXAMPLES = {
  issue_id: 42,
  file_date: '2026-03-01',
} as const;

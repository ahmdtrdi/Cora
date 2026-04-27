# GAME Role - Development Log

## Recent Changes

### 1. Created Question JSON Schema
**The Change:** 
Added TypeScript interfaces and validation logic for `Question` and `Option` structures in `packages/shared-types/src/question.ts`. This standardizes the expected format from our Agents and will be used by both the backend and frontend.

**The Reasoning:**
We need a unified structure to validate the AI-generated questions to avoid unexpected runtime errors. Putting it in `shared-types` allows all aspects of the application to reuse these strict types, and moving the documentation to this DEVLOG keeps `AGENTS.md` focused on agent behavior rather than schema details.

**The Tech Debt:**
Currently using manual runtime validation in `validateQuestion`. Consider migrating to Zod if schema complexity grows to automatically derive TypeScript interfaces and perform more robust runtime validations.

---

## Data Structures

### Question JSON Structure

The Agent is expected to generate questions following this structure:

**Root Object (Question)**
| Property | Data Type | Required | Description | Validation Rules |
|----------|-----------|----------|-------------|------------------|
| `id` | String | ✅ | Unique identifier. | Recommended format: `q_[category]_[number]` |
| `category` | String | ✅ | The category of the question. | Allowed values: `"sequence"`, `"logical"`, `"math"` |
| `questionText` | String | ✅ | Main text of the question. | - |
| `options` | Array | ✅ | List of multiple choices. | Must contain exactly 4 `Option` objects. |
| `explanation` | String | ✅ | Explanation or solution. | - |

**Option Object (Inside `options`)**
| Property | Data Type | Required | Description | Validation Rules |
|----------|-----------|----------|-------------|------------------|
| `id` | String | ✅ | Identifier for the answer option. | Usually `"A"`, `"B"`, `"C"`, `"D"` |
| `text` | String | ✅ | Text of the answer option. | - |
| `score` | Boolean | ✅ | Determines if this is correct. | - |

**Example:**
```json
[
  {
    "id": "q_math_001",
    "category": "math",
    "questionText": "Berapa hasil dari 5 + 7 * 2?",
    "options": [
      {
        "id": "A",
        "text": "24",
        "score": false
      },
      {
        "id": "B",
        "text": "19",
        "score": true
      },
      {
        "id": "C",
        "text": "17",
        "score": false
      },
      {
        "id": "D",
        "text": "12",
        "score": false
      }
    ],
    "explanation": "Sesuai aturan hierarki operasi matematika, perkalian dikerjakan lebih dulu: 7 * 2 = 14. Kemudian 5 + 14 = 19."
  }
]
```

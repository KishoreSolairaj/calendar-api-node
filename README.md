# calendar-api-node
A Node.js REST API that detects and resolves calendar scheduling conflicts with intelligent time suggestions.

---

##  Project Structure
```
calendar-conflict-resolver/
├─ package.json
├─ README.md
├─ .env
└─ src/
     ├─ index.js                # entrypoint
     ├─ app.js                  # express app + middleware
     ├─ config/
     │  └─ defaults.js
     ├─ routes/
     │  └─ conflicts.js
     ├─ controllers/
     │  └─ conflictController.js
     ├─ services/
     │  ├─ calendarService.js   # in-memory calendar store
     │  └─ conflictService.js   # conflict detection + suggestions
     ├─ utils/
     │  └─ timeUtils.js
     └─ middleware/
        └─ validateBody.js
```

---

##  Getting Started

###  1. Clone the repository
- git https://github.com/KishoreSolairaj/calendar-api-node.git
- cd calendar-api-node

###  2. Install dependencies
- npm install

### 3. Run the development server
- npm run dev
- After compailation which run at http://localhost:3000/

---

## API Endpoints

### 1. POST /api/check-conflicts
- Checks if the given meeting conflicts with existing meetings for any participant.
- Request Body: {
  "title": "Client Call",
  "start": "2025-09-11T11:15:00.000Z",
  "end": "2025-09-11T11:20:00.000Z",
  "participants": ["user2", "user6"]
}

- Response: {
    "message": "Event added successfully",
    "proposedEvent": {
        "title": "Client Call",
        "start": "2025-09-11T11:15:00.000Z",
        "end": "2025-09-11T11:20:00.000Z",
        "participants": [
            "user2",
            "user6"
        ]
    }
}

### 2. POST /api/suggest-times

- Suggests alternative available meeting times that do not conflict with participants' schedules and are within working hours.
- Request Body: {
  "title": "Client Call",
  "start": "2025-09-11T10:00:00.000Z",
  "end": "2025-09-11T11:00:00.000Z",
  "participants": ["user2", "user6"]
}
- Response : {
    "message": "Suggested times",
    "suggestions": [
        {
            "start": "2025-09-11T11:35:00.000Z",
            "end": "2025-09-11T12:35:00.000Z"
        },
        {
            "start": "2025-09-12T09:00:00.000Z",
            "end": "2025-09-12T10:00:00.000Z"
        },
        {
            "start": "2025-09-13T09:00:00.000Z",
            "end": "2025-09-13T10:00:00.000Z"
        }
    ]
}

---

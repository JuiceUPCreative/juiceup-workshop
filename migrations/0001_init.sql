-- Workshops are stored as JSON documents; code is the public join code.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL
);

-- One immutable response per participant per workshop.
CREATE TABLE IF NOT EXISTS responses (
  session_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  answers TEXT NOT NULL,
  PRIMARY KEY (session_id, participant_id)
);

-- Participants who pressed "Začít" (for the started vs. submitted metric).
CREATE TABLE IF NOT EXISTS starts (
  session_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  PRIMARY KEY (session_id, participant_id)
);

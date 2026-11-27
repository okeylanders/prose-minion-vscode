# Workshop pasted text attachments

Accepted 2026-11-27. Extends the message-attachment contract in ADR 2026-11-14.

A plain-text paste of at least 500 UTF-16 code units stages a separate **Pasted text** attachment. The host assigns its `ta-N`, preserves whitespace and bounds its body to 5,000 words and 40,000 UTF-16 code units. Equal pastes have distinct IDs. Each pending or sent reference carries the optional, exact `pastedText` metadata. Its `truncated` flag identifies a cut. A cut records the kept and original character and word counts, including a single word shortened at the character limit. No session version changes.

Each stage, read, update, take or remove names a room revision and request ID. Edit preserves the ID. Take removes the pending item and returns its text for insertion at the writer’s cursor. Only read and take return the retained body. Pending mutations settle before send. The host refuses changes during an active run or session replacement.

An attachment-only writer turn keeps an empty message body. The bubble displays the attachment count, and Rewind restores the empty draft with its original pills. Participant frames identify pasted material as quoted text and neutralize reserved delimiters. Transcript and recall projections carry the attachment label.

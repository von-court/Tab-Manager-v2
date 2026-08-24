## MODIFIED Requirements

### Requirement: Notion settings panel

The system SHALL add one "Notion tab archive" panel to the existing settings dialog containing:
a password-style token field with show/hide and a Verify action, a target-DB picker (combobox
searching databases shared with the integration, showing the resolved property mapping as a
hint), a staleness-threshold slider (1–72 h, default 3 h), an "exclude pinned tabs" toggle
(default on), an "exclude grouped tabs" toggle (default on), a fixed-properties editor (add/remove
`property → static value` pairs, property choices and value inputs driven by the resolved
target's real property list and types), an auto-archive properties editor with the same editing
model whose pairs apply only to unattended runs, a content-depth control ("Bookmark only" /
"Bookmark + page content", default "Bookmark only"), an auto-archive toggle, a per-run cap
control, and a hint naming the browser-level archive command and pointing at the browser's
extension-shortcuts page, since a command with no default binding is otherwise undiscoverable.
Auto-archive controls and both property editors SHALL be disabled until token and target are
verified.

#### Scenario: Configuring from scratch

- **WHEN** the user opens settings, pastes a valid token, verifies, and picks a shared DB
- **THEN** the mapping hint (e.g. "Title → Name, URL → Link") is shown and archive features
  become available

#### Scenario: Auto controls gated

- **WHEN** no verified token+target exists
- **THEN** the auto-archive toggle, cap control, and both property editors are disabled

#### Scenario: Adding a fixed property

- **WHEN** a verified target is selected and the user adds a fixed property, choosing an existing
  `select` property and one of its options as the value
- **THEN** the pairing is available to pick from the target's real property list (not free text)
  and is saved for use on every future archive

#### Scenario: Adding an auto-archive property

- **WHEN** a verified target is selected and the user adds `Tags = "auto-archived-tab"` in the
  auto-archive properties editor
- **THEN** the pairing is offered from the same real property list and is saved for use on
  unattended runs only, leaving the always-on fixed properties untouched

#### Scenario: The same property in both editors

- **WHEN** a property already configured as a fixed property is added in the auto-archive
  properties editor
- **THEN** the editor accepts it, and the value it takes on an unattended run follows the
  merge rule in `tab-archiving`

#### Scenario: Discovering the archive command

- **WHEN** the user opens the panel without having bound a key to the browser-level archive
  command
- **THEN** the panel names the command and points at the page where shortcuts are assigned

#### Scenario: Exclusion toggles default on

- **WHEN** the panel is opened for the first time
- **THEN** "exclude pinned tabs" and "exclude grouped tabs" are both shown as on, matching prior
  hardcoded behavior for pinned tabs

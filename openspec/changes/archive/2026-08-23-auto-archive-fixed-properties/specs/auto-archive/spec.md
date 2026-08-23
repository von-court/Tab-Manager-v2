## ADDED Requirements

### Requirement: Unattended runs apply the auto-archive property set

Each unattended run SHALL read the configured auto-archive property set from storage at fire time
along with the rest of its state, and apply it to every page it creates, merged with the
always-on fixed properties per `tab-archiving`. A failure to resolve or apply that set SHALL NOT
abort the run or keep a tab from being archived.

#### Scenario: Set read at fire time

- **WHEN** the alarm fires after the user changed the auto-archive properties and the service
  worker was restarted in between
- **THEN** the run applies the current set, read from storage

#### Scenario: No set configured

- **WHEN** the alarm fires and no auto-archive properties are configured
- **THEN** pages are created exactly as before, with the always-on fixed properties only

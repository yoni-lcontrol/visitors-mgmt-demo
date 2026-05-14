# Postman Testing Flow: Add Visitor with License Plate to Amadeus 8

## Architecture Overview

In Amadeus 8, **there is no separate "visitor" entity** — a visitor is a **Cardholder** with a specific `cardholderTypeUID` (configured as `VisitorCardholderTypeUid` in appsettings).

**License plates in Amadeus 8 are NOT badges/credentials.** They are stored in `API_CardholderPersonalDetails` under the field `carRegistrationNum`. The integration service handles this automatically when you pass `licensePlate` in the create request.

However, if your LPR system requires a **badge/card** record (for controller-based matching), a separate `POST /odata/API_Cards` call is also documented below.

---

## Postman Variables Setup

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `{{baseUrl}}` | Amadeus integration service URL | `http://localhost:5050` |
| `{{amadeusBaseUrl}}` | Amadeus 8 server direct URL | `http://10.0.0.238:10695` |
| `{{apiKey}}` | Amadeus API key | `da5c3bbb-3efb-4208-9542-6dc24699c9e1` |
| `{{username}}` | Amadeus username | `admin` |
| `{{password}}` | Amadeus password | `admin` |
| `{{token}}` | Bearer token (auto-saved) | — |
| `{{visitorId}}` | Created visitor AmadeusUid (auto-saved) | — |
| `{{cardholderId}}` | Same as visitorId (alias) | — |
| `{{accessGroupId}}` | Access group API key for parking | (get from Step 2) |
| `{{badgeId}}` | Badge UID if API_Cards is used | — |
| `{{licensePlate}}` | Vehicle license plate number | `12-345-67` |
| `{{validFrom}}` | Visitor validity start (ISO 8601) | `2026-05-11T00:00:00Z` |
| `{{validTo}}` | Visitor validity end (ISO 8601) | `2026-06-11T23:59:59Z` |
| `{{visitorTypeUid}}` | Visitor cardholder type UID | `22222222-2222-2222-2222-222222222222` |

---

## Testing Flow

There are **two approaches** depending on your target:

- **Path A** (Recommended): Call the **integration service** (`{{baseUrl}}`) which handles Amadeus communication internally.
- **Path B** (Direct): Call the **Amadeus 8 OData API** (`{{amadeusBaseUrl}}`) directly for lower-level control.

---

## PATH A: Via Integration Service (Recommended)

### Step 1: Create Visitor with License Plate (Single Request)

The integration service creates the cardholder in Amadeus AND upserts the license plate in one call.

```
Request Name: Create Visitor with License Plate
Method: POST
URL: {{baseUrl}}/api/cardholders/visitors
Headers:
  Content-Type: application/json
Body:
{
  "firstName": "Test",
  "lastName": "Visitor",
  "company": "Test Company",
  "fromDateValid": "{{validFrom}}",
  "toDateValid": "{{validTo}}",
  "accessGroupApiKeys": ["{{accessGroupId}}"],
  "notes": "LPR test visitor"
}
```

**Tests Script:**
```javascript
pm.test("Visitor created successfully", function () {
    pm.response.to.have.status(201);
});

pm.test("Response has AmadeusExternalId", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.amadeusExternalId).to.not.be.null;
    pm.expect(jsonData.success).to.be.true;
});

var jsonData = pm.response.json();
pm.collectionVariables.set("visitorId", jsonData.amadeusExternalId);
pm.collectionVariables.set("cardholderId", jsonData.amadeusExternalId);
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "amadeusExternalId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "syncStatus": "Synced",
  "lastSyncedAtUtc": "2026-05-11T10:00:00Z",
  "errorMessage": null,
  "isRetryable": false
}
```

**Notes:**
- The `CreateVisitorAsync` method automatically sets `cardholderTypeUID` to the configured `VisitorCardholderTypeUid`.
- Date validation: `toDateValid` must be after `fromDateValid` and in the future.
- The visitor endpoint does NOT accept `licensePlate` directly — license plate must be added separately (see Step 2).

---

### Step 1-ALT: Create Cardholder with License Plate (Full Control)

If you want the license plate set on creation, use the generic cardholder endpoint:

```
Request Name: Create Cardholder with License Plate
Method: POST
URL: {{baseUrl}}/api/cardholders
Headers:
  Content-Type: application/json
Body:
{
  "cardholderIdNumber": "VISITOR-LPR-001",
  "firstName": "Test",
  "lastName": "Visitor",
  "description": "LPR test visitor - Test Company",
  "cardholderTypeUid": "{{visitorTypeUid}}",
  "accessGroupApiKeys": ["{{accessGroupId}}"],
  "fromDateValid": "{{validFrom}}",
  "toDateValid": "{{validTo}}",
  "isFromDateActive": true,
  "isToDateActive": true,
  "licensePlate": "{{licensePlate}}"
}
```

**Tests Script:**
```javascript
pm.test("Cardholder created successfully", function () {
    pm.response.to.have.status(201);
});

pm.test("Response has AmadeusUid and license plate", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.amadeusUid).to.not.be.null;
    pm.expect(jsonData.licensePlate).to.eql(pm.collectionVariables.get("licensePlate"));
});

var jsonData = pm.response.json();
pm.collectionVariables.set("visitorId", jsonData.amadeusUid);
pm.collectionVariables.set("cardholderId", jsonData.amadeusUid);
```

**Expected Response (201 Created):**
```json
{
  "id": 1,
  "amadeusUid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "cardholderIdNumber": "VISITOR-LPR-001",
  "firstName": "Test",
  "lastName": "Visitor",
  "description": "LPR test visitor - Test Company",
  "status": "Active",
  "securityGroupUid": null,
  "securityGroupApiKey": null,
  "accessGroupUidsRaw": "...",
  "accessGroupApiKeysRaw": "{{accessGroupId}}",
  "licensePlate": "12-345-67",
  "isDeleted": false,
  "isArchived": false,
  "createdUtc": "2026-05-11T10:00:00Z",
  "updatedUtc": "2026-05-11T10:00:00Z"
}
```

**Notes:**
- This is the **recommended approach** for LPR visitors because it creates the cardholder AND writes the license plate to `API_CardholderPersonalDetails.carRegistrationNum` in a single request.
- The service calls `UpsertLicensePlateAsync` automatically when `licensePlate` is non-empty.

---

### Step 2: Verify Visitor Created

```
Request Name: Get Visitor by UID
Method: GET
URL: {{baseUrl}}/api/cardholders/{{visitorId}}
Headers:
  Content-Type: application/json
Body: (none)
```

**Tests Script:**
```javascript
pm.test("Visitor exists", function () {
    pm.response.to.have.status(200);
});

pm.test("License plate is set", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.licensePlate).to.eql(pm.collectionVariables.get("licensePlate"));
    pm.expect(jsonData.firstName).to.eql("Test");
    pm.expect(jsonData.lastName).to.eql("Visitor");
});

pm.test("Access group is assigned", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.accessGroupApiKeysRaw).to.include(pm.collectionVariables.get("accessGroupId"));
});
```

**Expected Response (200 OK):**
```json
{
  "id": 1,
  "amadeusUid": "{{visitorId}}",
  "firstName": "Test",
  "lastName": "Visitor",
  "licensePlate": "12-345-67",
  "accessGroupApiKeysRaw": "{{accessGroupId}}",
  "isDeleted": false,
  "isArchived": false
}
```

---

### Step 3: List Access Groups (to find parking access group)

```
Request Name: List Access Groups
Method: GET
URL: {{baseUrl}}/api/accessgroups
Headers:
  Content-Type: application/json
Body: (none)
```

**Tests Script:**
```javascript
pm.test("Access groups returned", function () {
    pm.response.to.have.status(200);
    var jsonData = pm.response.json();
    pm.expect(jsonData.length).to.be.above(0);
});

// Log all access groups to console for inspection
console.log("Available access groups:", JSON.stringify(pm.response.json(), null, 2));
```

**Notes:**
- Run this BEFORE creating the visitor to find the correct `accessGroupId` (API key) for your parking/LPR group.
- Look for an access group whose name contains "Parking", "LPR", "Vehicle", or similar.

---

### Step 4: Cleanup - Delete Visitor

```
Request Name: Delete Visitor
Method: DELETE
URL: {{baseUrl}}/api/cardholders/visitors/{{visitorId}}
Headers:
  Content-Type: application/json
Body: (none)
```

**Tests Script:**
```javascript
pm.test("Visitor deleted successfully", function () {
    var status = pm.response.code;
    pm.expect(status).to.be.oneOf([200, 204]);
});
```

---

## PATH B: Direct Amadeus 8 OData API

Use this path to interact directly with the Amadeus 8 server without the integration service.

### Step B1: Get Token

```
Request Name: Amadeus 8 - Get Token
Method: POST
URL: {{amadeusBaseUrl}}/api/Token
Headers:
  Content-Type: application/json
Body:
{
  "ApiKey": "{{apiKey}}",
  "Username": "{{username}}",
  "Password": "{{password}}"
}
```

**Tests Script:**
```javascript
pm.test("Token received successfully", function () {
    pm.response.to.have.status(200);
    var jsonData = pm.response.json();
    pm.expect(jsonData.successful).to.be.true;
    pm.expect(jsonData.token).to.not.be.empty;
});

var jsonData = pm.response.json();
pm.collectionVariables.set("token", jsonData.token);
```

**Expected Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR...",
  "successful": true,
  "error": null
}
```

**Notes:**
- Token does not have an explicit `expires_in` field — assume ~60 minutes.
- If `successful` is `false`, check the `error` field.

---

### Step B2: List Access Groups

```
Request Name: Amadeus 8 - List Access Groups
Method: GET
URL: {{amadeusBaseUrl}}/odata/API_AccessGroups
Headers:
  Authorization: Bearer {{token}}
  Content-Type: application/json
Body: (none)
```

**Tests Script:**
```javascript
pm.test("Access groups retrieved", function () {
    pm.response.to.have.status(200);
});

console.log("Access Groups:", JSON.stringify(pm.response.json(), null, 2));

// Save first parking-related group if found
var data = pm.response.json();
var groups = data.value || data;
var parkingGroup = groups.find(g => 
    (g.name || g.Name || "").toLowerCase().includes("parking") ||
    (g.name || g.Name || "").toLowerCase().includes("lpr") ||
    (g.name || g.Name || "").toLowerCase().includes("vehicle")
);
if (parkingGroup) {
    pm.collectionVariables.set("accessGroupId", parkingGroup.apiKey || parkingGroup.ApiKey);
    console.log("Found parking group:", parkingGroup.name || parkingGroup.Name);
}
```

---

### Step B3: Create Cardholder (Visitor)

```
Request Name: Amadeus 8 - Create Visitor Cardholder
Method: POST
URL: {{amadeusBaseUrl}}/odata/API_Cardholders
Headers:
  Authorization: Bearer {{token}}
  Content-Type: application/json
Body:
{
  "firstName": "Test",
  "lastName": "Visitor",
  "cardholderIdNumber": "VISITOR-LPR-001",
  "cardholderTypeUID": "{{visitorTypeUid}}",
  "description": "LPR test visitor - Test Company",
  "accessGroupApiKeys": "{{accessGroupId}}",
  "fromDateValid": "{{validFrom}}",
  "toDateValid": "{{validTo}}",
  "isFromDateActive": true,
  "isToDateActive": true
}
```

**Tests Script:**
```javascript
pm.test("Cardholder created", function () {
    pm.response.to.have.status(201);
});

var jsonData = pm.response.json();
// Amadeus OData typically returns the ID as "id" or "uid" or "ID"
var uid = jsonData.id || jsonData.uid || jsonData.ID || jsonData.Id;
pm.collectionVariables.set("visitorId", uid);
pm.collectionVariables.set("cardholderId", uid);
console.log("Created cardholder UID:", uid);
```

**Expected Response (201 Created):**
```json
{
  "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "firstName": "Test",
  "lastName": "Visitor",
  "cardholderIdNumber": "VISITOR-LPR-001",
  "cardholderTypeUID": "22222222-2222-2222-2222-222222222222",
  "status": "Active",
  "fromDateValid": "2026-05-11T00:00:00Z",
  "toDateValid": "2026-06-11T23:59:59Z"
}
```

**Notes:**
- `accessGroupApiKeys` is a **comma-separated string** (not an array) when calling the Amadeus OData API directly.
- `cardholderTypeUID` must match the visitor type configured in Amadeus.

---

### Step B4: Add License Plate via Personal Details

In Amadeus 8, the license plate is stored in `API_CardholderPersonalDetails.carRegistrationNum`.

```
Request Name: Amadeus 8 - Add License Plate
Method: POST
URL: {{amadeusBaseUrl}}/odata/API_CardholderPersonalDetails
Headers:
  Authorization: Bearer {{token}}
  Content-Type: application/json
Body:
{
  "cardholderUID": "{{visitorId}}",
  "carRegistrationNum": "{{licensePlate}}"
}
```

**Tests Script:**
```javascript
pm.test("License plate added", function () {
    var status = pm.response.code;
    pm.expect(status).to.be.oneOf([200, 201]);
});

var jsonData = pm.response.json();
console.log("Personal details created:", JSON.stringify(jsonData, null, 2));

// Save the personal details UID for future PATCH if needed
if (jsonData.uid || jsonData.Uid) {
    pm.collectionVariables.set("personalDetailsUid", jsonData.uid || jsonData.Uid);
}
```

**Expected Response (201 Created):**
```json
{
  "uid": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
  "cardholderUID": "{{visitorId}}",
  "carRegistrationNum": "12-345-67",
  "phone": null,
  "mobile": null,
  "email": null
}
```

**Notes:**
- If personal details already exist for this cardholder, use PATCH instead (see Step B4-ALT).
- This is the **primary LPR mechanism** in Amadeus 8 — the LPR camera reads the plate and matches against `carRegistrationNum`.

---

### Step B4-ALT: Update License Plate (PATCH existing personal details)

If the cardholder already has personal details:

```
Request Name: Amadeus 8 - Update License Plate
Method: PATCH
URL: {{amadeusBaseUrl}}/odata/API_CardholderPersonalDetails({{personalDetailsUid}})
Headers:
  Authorization: Bearer {{token}}
  Content-Type: application/json
Body:
{
  "carRegistrationNum": "{{licensePlate}}"
}
```

---

### Step B5: (Optional) Add Badge/Card for LPR Controller Matching

> **Important:** This step is only needed if your Amadeus installation uses controller-based LPR matching via the badge system instead of (or in addition to) the `carRegistrationNum` field.

```
Request Name: Amadeus 8 - Create LPR Badge
Method: POST
URL: {{amadeusBaseUrl}}/odata/API_Cards
Headers:
  Authorization: Bearer {{token}}
  Content-Type: application/json
Body:
{
  "cardholderUID": "{{visitorId}}",
  "cardNumber": "{{licensePlate}}",
  "cardTypeUID": "TODO_LPR_CARD_TYPE_UID",
  "fromDateValid": "{{validFrom}}",
  "toDateValid": "{{validTo}}",
  "isActive": true
}
```

**Tests Script:**
```javascript
pm.test("Badge created", function () {
    var status = pm.response.code;
    pm.expect(status).to.be.oneOf([200, 201]);
});

var jsonData = pm.response.json();
var badgeUid = jsonData.id || jsonData.uid || jsonData.ID;
pm.collectionVariables.set("badgeId", badgeUid);
console.log("Badge UID:", badgeUid);
```

**Notes:**
- `cardTypeUID` — **TODO**: Must be discovered from your Amadeus system. Query `GET /odata/$metadata` or check the Amadeus admin UI for the LPR/Vehicle card type UID.
- `cardNumber` — In LPR scenarios this is typically the license plate string.
- Not all Amadeus installations require this. The `carRegistrationNum` approach in Step B4 is usually sufficient for LPR camera matching.

---

### Step B6: Verify Cardholder in Amadeus

```
Request Name: Amadeus 8 - Get Cardholder
Method: GET
URL: {{amadeusBaseUrl}}/odata/API_Cardholders({{visitorId}})
Headers:
  Authorization: Bearer {{token}}
  Content-Type: application/json
Body: (none)
```

**Tests Script:**
```javascript
pm.test("Cardholder exists in Amadeus", function () {
    pm.response.to.have.status(200);
    var jsonData = pm.response.json();
    pm.expect(jsonData.firstName).to.eql("Test");
    pm.expect(jsonData.lastName).to.eql("Visitor");
});
```

---

### Step B7: Verify License Plate in Personal Details

```
Request Name: Amadeus 8 - Verify License Plate
Method: GET
URL: {{amadeusBaseUrl}}/odata/API_CardholderPersonalDetails?$filter=uid eq {{visitorId}}
Headers:
  Authorization: Bearer {{token}}
  Content-Type: application/json
Body: (none)
```

**Tests Script:**
```javascript
pm.test("Personal details found", function () {
    pm.response.to.have.status(200);
});

pm.test("License plate matches", function () {
    var data = pm.response.json();
    var records = data.value || data;
    var record = Array.isArray(records) ? records[0] : records;
    pm.expect(record.carRegistrationNum).to.eql(pm.collectionVariables.get("licensePlate"));
});
```

**Notes:**
- The filter `uid eq {{visitorId}}` queries by the cardholder UID. The actual filter field might be `cardholderUID` — check your Amadeus metadata: `GET /odata/$metadata`.
- Alternative: `GET /odata/API_CardholderPersonalDetails?$filter=cardholderUID eq {{visitorId}}`

---

### Step B8: (Optional) Controller Download / Sync

> Amadeus 8 typically syncs badge data to controllers automatically. If your system requires a manual trigger:

```
Request Name: Amadeus 8 - Trigger Controller Sync (via Integration Service)
Method: POST
URL: {{baseUrl}}/api/sync/cardholders
Headers:
  Content-Type: application/json
Body: (none)
```

**Tests Script:**
```javascript
pm.test("Sync triggered", function () {
    var status = pm.response.code;
    pm.expect(status).to.be.oneOf([200, 202]);
});
```

**Notes:**
- This syncs Amadeus data into the local integration DB, not to physical controllers.
- Physical controller programming (downloading badge data to hardware) is managed by the **Amadeus server itself** — there is no API endpoint in this integration service to push data to controllers.
- If the LPR camera/controller is not recognizing the plate after creation, check the Amadeus admin UI to confirm the controller has been updated.

---

## Complete Test Execution Order

### Path A (Integration Service):
1. `GET {{baseUrl}}/api/accessgroups` — Find parking access group
2. `POST {{baseUrl}}/api/cardholders` — Create visitor with license plate
3. `GET {{baseUrl}}/api/cardholders/{{visitorId}}` — Verify creation
4. `DELETE {{baseUrl}}/api/cardholders/visitors/{{visitorId}}` — Cleanup

### Path B (Direct Amadeus OData):
1. `POST {{amadeusBaseUrl}}/api/Token` — Authenticate
2. `GET {{amadeusBaseUrl}}/odata/API_AccessGroups` — Find parking group
3. `POST {{amadeusBaseUrl}}/odata/API_Cardholders` — Create visitor
4. `POST {{amadeusBaseUrl}}/odata/API_CardholderPersonalDetails` — Add license plate
5. `GET {{amadeusBaseUrl}}/odata/API_Cardholders({{visitorId}})` — Verify cardholder
6. `GET {{amadeusBaseUrl}}/odata/API_CardholderPersonalDetails?$filter=cardholderUID eq {{visitorId}}` — Verify plate
7. (Optional) `POST {{amadeusBaseUrl}}/odata/API_Cards` — Add badge if needed
8. `DELETE {{amadeusBaseUrl}}/odata/API_Cardholders({{visitorId}})` — Cleanup

---

## Key Clarifications

| Concept | Explanation |
|---------|-------------|
| Visitor vs Cardholder | A visitor IS a cardholder with a specific `cardholderTypeUID`. Amadeus does not have a separate visitor entity. |
| License Plate vs Badge | License plate is stored in `API_CardholderPersonalDetails.carRegistrationNum`. This is NOT a badge. Badges are in `API_Cards`. |
| LPR Matching | The LPR camera reads the plate and Amadeus matches it against `carRegistrationNum` in personal details. No badge record is needed for basic LPR. |
| Access Group vs Security Group | Access Groups control door access. Security Groups (MAGs) are broader multi-access groups. For parking gates, use the appropriate Access Group. |
| Controller Sync | Amadeus server handles syncing data to physical controllers. The integration service only mirrors data locally. |

---

## Troubleshooting

### 401 Unauthorized
- **Token expired**: Amadeus tokens last ~60 minutes. Re-run the token request.
- **Invalid credentials**: Verify `ApiKey`, `Username`, and `Password` match what's configured in Amadeus admin.
- **API not enabled**: In Amadeus admin, ensure "Allow API" is checked for the user account.
- **Token not attached**: Verify the `Authorization: Bearer {{token}}` header is present on all OData requests.

### Invalid Username/Password
- Check `appsettings.json` → `Amadeus.Username` and `Amadeus.Password`.
- Ensure the account is not locked in Amadeus admin console.
- Verify the `ApiKey` is correct — it's required alongside credentials.
- Try logging in through the Amadeus admin UI first to confirm credentials work.

### Visitor Created but Plate Not Working (Camera reads plate, no match)
- Verify `carRegistrationNum` is set correctly in `API_CardholderPersonalDetails` (no extra spaces, correct format).
- Check plate format matches what the LPR camera returns (with/without dashes: `12-345-67` vs `1234567`).
- Ensure the personal details record is linked to the correct `cardholderUID`.
- Verify the cardholder's `toDateValid` has not expired.
- Confirm `isFromDateActive` and `isToDateActive` are both `true`.

### Plate Recognized by Camera but Gate Does Not Open
- **Missing access group**: The cardholder must be assigned to the access group that controls the parking gate/barrier.
- **Wrong access group**: Verify the access group assigned includes the specific gate/reader for LPR.
- **Cardholder expired**: Check `fromDateValid` / `toDateValid` dates.
- **Cardholder archived/deleted**: Verify status is Active (not Archived/Deleted).
- **Controller not synced**: Check Amadeus admin → Controllers → verify last download timestamp is after the cardholder was created.

### Access Denied Because Access Group is Missing
- Query access groups: `GET /odata/API_AccessGroups` to find valid options.
- Ensure `accessGroupApiKeys` field was included in the create payload.
- After creation, verify with `GET /odata/API_Cardholders({{visitorId}})` that the access groups are actually assigned.
- If updating after creation, use `PATCH /odata/API_Cardholders({{visitorId}})` with the `accessGroupApiKeys` field.

### Controller Not Updated After Badge/Plate Creation
- Amadeus 8 server normally auto-syncs to controllers. Check the controller status in Amadeus admin.
- If manual sync is needed, use Amadeus admin UI → Controllers → Download All.
- The integration service (`POST /api/sync/cardholders`) only pulls data INTO the integration DB — it does NOT push to physical controllers.
- Check the Amadeus event log for any download errors or communication failures with the controller.
- Verify the controller is online and communicating (check `API_Controllers` status field).

### General Debugging Steps
1. Check `/odata/$metadata` to verify entity field names and types.
2. Use `GET /odata/API_Cardholders?$filter=cardholderIdNumber eq 'VISITOR-LPR-001'` to find your test cardholder.
3. Check Amadeus service logs for detailed error messages (the integration service logs to console in Development mode).
4. If POST returns 400, the payload field names are likely wrong — cross-reference with `$metadata`.

---

## TODO Items (Requires Manual Discovery)

| Item | How to Find |
|------|-------------|
| LPR Card Type UID (`cardTypeUID`) | Query `GET /odata/$metadata` for CardType entity or check Amadeus admin → Card Types |
| Exact parking Access Group API key | Run `GET /odata/API_AccessGroups` and find the one controlling your LPR barrier |
| Plate format (dashes vs no dashes) | Check what format your LPR camera reports — must match exactly |
| Whether `API_Cards` is needed for your LPR setup | Depends on your Amadeus + LPR camera configuration — test with `carRegistrationNum` first |
| Controller auto-sync timing | Check Amadeus admin → System Settings → Download Interval |

# API cURL Quickstart

This guide uses real backend endpoints (no mock data). Set `BASE_URL` to your deployed API (or local server).

## 1) Set variables

```bash
BASE_URL="http://localhost:3000"
EMAIL="api-user@example.com"
PASSWORD="StrongPassw0rd!"
USERNAME="api_user_01"
DISPLAY_NAME="API User"
```

## 2) Health checks

```bash
curl -s "$BASE_URL/health" | jq
curl -s "$BASE_URL/ready" | jq
```

## 3) Register and login

```bash
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"displayName\":\"$DISPLAY_NAME\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"language\":\"tr\"}" | jq

LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.refreshToken')
```

## 4) Call protected endpoints

```bash
curl -s "$BASE_URL/users/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq

ROOM_RESPONSE=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Prod Readiness Room","description":"Created from cURL quickstart","category":"technology","language":"tr","visibility":"public","maxSpeakers":6}')

ROOM_ID=$(echo "$ROOM_RESPONSE" | jq -r '.id')
```

## 5) Join room and refresh token

```bash
curl -s -X POST "$BASE_URL/rooms/$ROOM_ID/join" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq

curl -s -X POST "$BASE_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}" | jq
```

## 6) Submit moderation report

```bash
REPORT_RESPONSE=$(curl -s -X POST "$BASE_URL/moderation/report" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"targetType\":\"room\",\"roomId\":\"$ROOM_ID\",\"category\":\"spam\",\"description\":\"Automated API test report\"}")

echo "$REPORT_RESPONSE" | jq
REPORT_ID=$(echo "$REPORT_RESPONSE" | jq -r '.reportId')
```

## 7) Logout

```bash
curl -s -X POST "$BASE_URL/auth/logout" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

## 8) Admin moderation flow (optional)

Use an account with admin role.

```bash
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="StrongAdminPassw0rd!"

ADMIN_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

ADMIN_ACCESS_TOKEN=$(echo "$ADMIN_LOGIN_RESPONSE" | jq -r '.accessToken')

curl -s "$BASE_URL/moderation/reports?status=pending&page=1&limit=20" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" | jq

curl -s "$BASE_URL/moderation/reports/$REPORT_ID" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" | jq

curl -s -X PATCH "$BASE_URL/moderation/reports/$REPORT_ID/resolve" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" | jq

curl -s "$BASE_URL/moderation/audit/room/$ROOM_ID?limit=100" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" | jq
```

If a request fails, backend errors return:
`{ "requestId": "...", "code": "...", "message": "..." }`

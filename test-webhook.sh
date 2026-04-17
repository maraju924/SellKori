#!/bin/bash

# Replace with your actual business ID from the dashboard
BUSINESS_ID="biz-1713098212345" # Example ID, user should use theirs
VERIFY_TOKEN="my_secret_token" # The token set in the dashboard

echo "Testing Webhook Verification (GET)..."
curl -X GET "http://localhost:3000/api/webhook/$BUSINESS_ID?hub.mode=subscribe&hub.verify_token=$VERIFY_TOKEN&hub.challenge=CHALLENGE_ACCEPTED"
echo -e "\n"

echo "Testing Webhook Message Handling (POST)..."
curl -X POST "http://localhost:3000/api/webhook/$BUSINESS_ID" \
     -H "Content-Type: application/json" \
     -d '{
       "object": "page",
       "entry": [
         {
           "id": "PAGE_ID",
           "time": 123456789,
           "messaging": [
             {
               "sender": { "id": "USER_ID" },
               "recipient": { "id": "PAGE_ID" },
               "timestamp": 123456789,
               "message": {
                 "text": "Hello, I want to buy a product"
               }
             }
           ]
         }
       ]
     }'
echo -e "\n"

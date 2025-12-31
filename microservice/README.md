# Escrow Microservice

REST API microservice that allows any backend (PHP, Python, Go, etc.) to interact with the Solana Escrow System.

## Quick Start

```bash
cd microservice
npm install
npm start
```

The server runs on `http://localhost:3001`

## Configuration

Set environment variables:

```bash
export PROGRAM_ID="9pZmQesbcR58wxt3bncrm1S615sv2nr3LJYpcah1B6LB"
export RPC_URL="https://api.devnet.solana.com"
export PORT=3001
```

## API Endpoints

### Health Check

```
GET /health
```

Response:
```json
{
  "status": "ok",
  "programId": "9pZmQesbcR58wxt3bncrm1S615sv2nr3LJYpcah1B6LB",
  "rpcUrl": "https://api.devnet.solana.com"
}
```

### Create Escrow

```
POST /escrow/create
```

Body:
```json
{
  "buyerKeypair": [1, 2, 3, ...],
  "seller": "SellerPublicKeyBase58",
  "mint": "TokenMintAddressBase58",
  "amount": 1000000,
  "releaseConditions": "Product delivery required",
  "timeoutSeconds": 604800
}
```

Response:
```json
{
  "success": true,
  "escrowId": "EscrowPDAAddress",
  "vaultId": "VaultPDAAddress",
  "escrowSeed": "1234567890",
  "transaction": "TxSignature"
}
```

### Deposit Funds

```
POST /escrow/deposit
```

Body:
```json
{
  "buyerKeypair": [1, 2, 3, ...],
  "escrowId": "EscrowPDAAddress",
  "mint": "TokenMintAddressBase58"
}
```

### Release Funds

```
POST /escrow/release
```

Body:
```json
{
  "authorityKeypair": [1, 2, 3, ...],
  "escrowId": "EscrowPDAAddress"
}
```

### Cancel Escrow

```
POST /escrow/cancel
```

Body:
```json
{
  "buyerKeypair": [1, 2, 3, ...],
  "escrowId": "EscrowPDAAddress"
}
```

### Get Escrow Info

```
GET /escrow/:escrowId
```

Response:
```json
{
  "success": true,
  "escrow": {
    "id": "EscrowPDAAddress",
    "buyer": "BuyerPublicKey",
    "seller": "SellerPublicKey",
    "mint": "TokenMint",
    "amount": "1000000",
    "state": "funded",
    "releaseConditions": "Product delivery required",
    "createdAt": "1234567890",
    "fundedAt": "1234567891",
    "timeoutAt": "1234567892",
    "arbiter": null
  }
}
```

### Set Arbiter

```
POST /escrow/set-arbiter
```

Body:
```json
{
  "buyerKeypair": [1, 2, 3, ...],
  "escrowId": "EscrowPDAAddress",
  "arbiter": "ArbiterPublicKeyBase58"
}
```

## Usage Examples

### PHP / Laravel

```php
<?php

class EscrowService
{
    private $baseUrl = 'http://localhost:3001';
    
    public function createEscrow($buyerKeypair, $seller, $mint, $amount)
    {
        $response = Http::post("{$this->baseUrl}/escrow/create", [
            'buyerKeypair' => $buyerKeypair,
            'seller' => $seller,
            'mint' => $mint,
            'amount' => $amount,
            'releaseConditions' => 'Order fulfillment required',
        ]);
        
        return $response->json();
    }
    
    public function getEscrow($escrowId)
    {
        return Http::get("{$this->baseUrl}/escrow/{$escrowId}")->json();
    }
    
    public function releaseEscrow($authorityKeypair, $escrowId)
    {
        return Http::post("{$this->baseUrl}/escrow/release", [
            'authorityKeypair' => $authorityKeypair,
            'escrowId' => $escrowId,
        ])->json();
    }
}
```

### Python / Django

```python
import requests

class EscrowService:
    def __init__(self, base_url='http://localhost:3001'):
        self.base_url = base_url
    
    def create_escrow(self, buyer_keypair, seller, mint, amount):
        response = requests.post(f'{self.base_url}/escrow/create', json={
            'buyerKeypair': buyer_keypair,
            'seller': seller,
            'mint': mint,
            'amount': amount,
            'releaseConditions': 'Order fulfillment required',
        })
        return response.json()
    
    def get_escrow(self, escrow_id):
        response = requests.get(f'{self.base_url}/escrow/{escrow_id}')
        return response.json()
    
    def release_escrow(self, authority_keypair, escrow_id):
        response = requests.post(f'{self.base_url}/escrow/release', json={
            'authorityKeypair': authority_keypair,
            'escrowId': escrow_id,
        })
        return response.json()
```

### Go

```go
package escrow

import (
    "bytes"
    "encoding/json"
    "net/http"
)

type EscrowService struct {
    BaseURL string
}

type CreateEscrowRequest struct {
    BuyerKeypair      []int  `json:"buyerKeypair"`
    Seller            string `json:"seller"`
    Mint              string `json:"mint"`
    Amount            int64  `json:"amount"`
    ReleaseConditions string `json:"releaseConditions"`
}

func (s *EscrowService) CreateEscrow(req CreateEscrowRequest) (map[string]interface{}, error) {
    body, _ := json.Marshal(req)
    resp, err := http.Post(s.BaseURL+"/escrow/create", "application/json", bytes.NewBuffer(body))
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var result map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)
    return result, nil
}
```

## Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

```bash
docker build -t escrow-microservice .
docker run -p 3001:3001 -e RPC_URL=https://api.devnet.solana.com escrow-microservice
```

## Security Notes

1. **Never expose keypairs in client-side code** - Use server-side only
2. **Use HTTPS in production** - Encrypt all API traffic
3. **Add authentication** - Protect endpoints with API keys or JWT
4. **Rate limiting** - Prevent abuse with rate limits
5. **Input validation** - Validate all inputs before processing


<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ yarn install
```

## Running the app

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Test

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Finance Module

The Finance module provides expense/income tracking, category management, currency rates, and currency conversions.

### Running Migrations

```bash
# Generate and apply new migrations
npx prisma migrate dev

# Apply migrations in production
npx prisma migrate deploy

# View current migration status
npx prisma migrate status
```

### API Endpoints

All finance endpoints require JWT authentication. Include the `Authorization: Bearer <token>` header.

#### Finance Articles (Categories)

```bash
# Create expense article
curl -X POST http://localhost:3000/api/finance/articles \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "EXPENSE",
    "name": "Food & Dining",
    "color": "#FF5733"
  }'

# Create income article
curl -X POST http://localhost:3000/api/finance/articles \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "INCOME",
    "name": "Salary",
    "color": "#00FF00"
  }'

# List articles (filter by kind)
curl -X GET "http://localhost:3000/api/finance/articles?kind=EXPENSE&includeArchived=false" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get single article
curl -X GET http://localhost:3000/api/finance/articles/{id} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Update article
curl -X PATCH http://localhost:3000/api/finance/articles/{id} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Groceries",
    "color": "#00FF00"
  }'

# Delete/archive article
curl -X DELETE http://localhost:3000/api/finance/articles/{id} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Finance Records (Expenses/Incomes)

```bash
# Create expense record
curl -X POST http://localhost:3000/api/finance/records \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "EXPENSE",
    "amount": "150.50",
    "currency": "USD",
    "articleId": "article-uuid-here",
    "remark": "Lunch with team",
    "operationDate": "2024-01-15T12:00:00Z"
  }'

# Create income record
curl -X POST http://localhost:3000/api/finance/records \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INCOME",
    "amount": "5000.00",
    "currency": "USD",
    "articleId": "salary-article-uuid",
    "remark": "January salary",
    "operationDate": "2024-01-31T00:00:00Z"
  }'

# List records with filters
curl -X GET "http://localhost:3000/api/finance/records?type=EXPENSE&currency=USD&from=2024-01-01&to=2024-12-31&page=1&limit=20&sortBy=operationDate&sortOrder=desc" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Search records by remark or article name
curl -X GET "http://localhost:3000/api/finance/records?search=lunch" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get single record
curl -X GET http://localhost:3000/api/finance/records/{id} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Update record
curl -X PATCH http://localhost:3000/api/finance/records/{id} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "175.00",
    "remark": "Updated remark"
  }'

# Delete record
curl -X DELETE http://localhost:3000/api/finance/records/{id} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Currency Rates

```bash
# Create currency rate
curl -X POST http://localhost:3000/api/finance/rates \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "baseCurrency": "USD",
    "quoteCurrency": "EUR",
    "rate": "0.92",
    "source": "manual",
    "effectiveAt": "2024-01-15T00:00:00Z"
  }'

# Create another rate (USD/TMT)
curl -X POST http://localhost:3000/api/finance/rates \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "baseCurrency": "USD",
    "quoteCurrency": "TMT",
    "rate": "3.50",
    "source": "manual",
    "effectiveAt": "2024-01-15T00:00:00Z"
  }'

# List rates with filters
curl -X GET "http://localhost:3000/api/finance/rates?base=USD&quote=EUR&from=2024-01-01&to=2024-12-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get latest rate for currency pair
curl -X GET "http://localhost:3000/api/finance/rates/latest?base=USD&quote=EUR" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get rate as of specific date
curl -X GET "http://localhost:3000/api/finance/rates/latest?base=USD&quote=EUR&asOf=2024-01-10T00:00:00Z" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Currency Conversions

```bash
# Create conversion (rate is looked up automatically)
curl -X POST http://localhost:3000/api/finance/conversions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fromAmount": "100.00",
    "fromCurrency": "USD",
    "toCurrency": "EUR",
    "operationDate": "2024-01-15T00:00:00Z",
    "remark": "Travel money"
  }'

# Create conversion with fee
curl -X POST http://localhost:3000/api/finance/conversions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fromAmount": "1000.00",
    "fromCurrency": "USD",
    "toCurrency": "TMT",
    "operationDate": "2024-01-15T00:00:00Z",
    "feeAmount": "10.00",
    "feeCurrency": "USD",
    "remark": "Exchange at bank"
  }'

# List conversions
curl -X GET "http://localhost:3000/api/finance/conversions?fromCurrency=USD&from=2024-01-01&to=2024-12-31&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get single conversion
curl -X GET http://localhost:3000/api/finance/conversions/{id} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Delete conversion
curl -X DELETE http://localhost:3000/api/finance/conversions/{id} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Finance Summary

```bash
# Get summary for period
curl -X GET "http://localhost:3000/api/finance/summary?from=2024-01-01&to=2024-12-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get summary with base currency conversion
curl -X GET "http://localhost:3000/api/finance/summary?from=2024-01-01&to=2024-12-31&baseCurrency=USD" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Summary Response Example:**
```json
{
  "income": {
    "USD": "5000.00",
    "EUR": "1200.00"
  },
  "expense": {
    "USD": "1500.00",
    "EUR": "300.00"
  },
  "conversionFees": {
    "USD": "15.00"
  },
  "incomeBaseCurrency": "6104.00",
  "expenseBaseCurrency": "1776.00",
  "netBaseCurrency": "4328.00"
}
```

### Data Model

- **FinanceArticle**: Categories for expenses/incomes (EXPENSE/INCOME kind)
- **FinanceRecord**: Individual expense/income entries with amount, currency, optional article
- **CurrencyRate**: Exchange rates (base/quote pair with effective date)
- **CurrencyConversion**: First-class conversion operations with automatic rate lookup

### Important Notes

- All money amounts are stored as DECIMAL in the database and transported as strings in API to avoid float precision issues
- Currency codes are normalized to uppercase ISO 3166 codes (e.g., USD, EUR, TMT)
- Articles can only be linked to records matching their kind (EXPENSE article to EXPENSE record)
- Deleting an article with existing records will archive it instead of hard delete
- Currency conversions automatically look up rates (direct or inverse) for the operation date

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://kamilmysliwiec.com)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](LICENSE).

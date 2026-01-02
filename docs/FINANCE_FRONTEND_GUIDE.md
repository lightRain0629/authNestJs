# Finance Module - Frontend Integration Guide (React)

This guide covers integrating the Finance API into a React application. Authentication is assumed to be already implemented.

## Table of Contents

- [TypeScript Interfaces](#typescript-interfaces)
- [API Service Setup](#api-service-setup)
- [API Endpoints Reference](#api-endpoints-reference)
  - [Articles (Categories)](#articles-categories)
  - [Records (Expenses/Incomes)](#records-expensesincomes)
  - [Currency Rates](#currency-rates)
  - [Currency Conversions](#currency-conversions)
  - [Summary](#summary)
- [React Hooks Examples](#react-hooks-examples)
- [Form Validation](#form-validation)
- [Error Handling](#error-handling)

---

## TypeScript Interfaces

Create a `types/finance.ts` file:

```typescript
// Enums
export type FinanceArticleKind = 'EXPENSE' | 'INCOME';
export type FinanceRecordType = 'EXPENSE' | 'INCOME';

// ============ Articles ============

export interface FinanceArticle {
  id: string;
  kind: FinanceArticleKind;
  name: string;
  color: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateArticleDto {
  kind: FinanceArticleKind;
  name: string;
  color?: string;
}

export interface UpdateArticleDto {
  name?: string;
  color?: string;
  isArchived?: boolean;
}

export interface ListArticlesParams {
  kind?: FinanceArticleKind;
  includeArchived?: boolean;
}

// ============ Records ============

export interface FinanceRecord {
  id: string;
  type: FinanceRecordType;
  amount: string; // Decimal as string
  currency: string;
  articleId: string | null;
  remark: string | null;
  operationDate: string;
  createdAt: string;
  updatedAt: string;
  article: {
    id: string;
    name: string;
    kind: string;
    color: string | null;
  } | null;
}

export interface CreateRecordDto {
  type: FinanceRecordType;
  amount: string; // Must be string like "150.50"
  currency: string; // 3-letter ISO code, uppercase
  articleId?: string;
  remark?: string;
  operationDate: string; // ISO 8601
}

export interface UpdateRecordDto {
  type?: FinanceRecordType;
  amount?: string;
  currency?: string;
  articleId?: string | null;
  remark?: string;
  operationDate?: string;
}

export interface ListRecordsParams {
  type?: FinanceRecordType;
  currency?: string;
  articleId?: string;
  from?: string; // ISO date
  to?: string; // ISO date
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'operationDate' | 'createdAt' | 'amount';
  sortOrder?: 'asc' | 'desc';
}

// ============ Currency Rates ============

export interface CurrencyRate {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: string; // Decimal as string
  source: string | null;
  effectiveAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRateDto {
  baseCurrency: string;
  quoteCurrency: string;
  rate: string;
  source?: string;
  effectiveAt: string;
}

export interface ListRatesParams {
  base?: string;
  quote?: string;
  from?: string;
  to?: string;
}

export interface LatestRateParams {
  base: string;
  quote: string;
  asOf?: string;
}

export interface LatestRateResponse {
  rate: CurrencyRate;
  effectiveRate: string;
  isInverse: boolean;
}

// ============ Conversions ============

export interface CurrencyConversion {
  id: string;
  fromAmount: string;
  fromCurrency: string;
  toAmount: string;
  toCurrency: string;
  rateUsed: string;
  rateId: string | null;
  feeAmount: string | null;
  feeCurrency: string | null;
  remark: string | null;
  operationDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConversionDto {
  fromAmount: string;
  fromCurrency: string;
  toCurrency: string;
  operationDate: string;
  feeAmount?: string;
  feeCurrency?: string;
  remark?: string;
}

export interface ListConversionsParams {
  fromCurrency?: string;
  toCurrency?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

// ============ Summary ============

export interface SummaryParams {
  from: string;
  to: string;
  baseCurrency?: string;
}

export interface SummaryResponse {
  income: Record<string, string>;
  expense: Record<string, string>;
  conversionFees?: Record<string, string>;
  incomeBaseCurrency?: string;
  expenseBaseCurrency?: string;
  netBaseCurrency?: string;
}

// ============ Pagination ============

export interface PaginatedResponse<T> {
  count: number;
  current_page: number;
  total_pages: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
```

---

## API Service Setup

Create `services/financeApi.ts`:

```typescript
import axios, { AxiosInstance } from 'axios';
import {
  FinanceArticle,
  CreateArticleDto,
  UpdateArticleDto,
  ListArticlesParams,
  FinanceRecord,
  CreateRecordDto,
  UpdateRecordDto,
  ListRecordsParams,
  CurrencyRate,
  CreateRateDto,
  ListRatesParams,
  LatestRateParams,
  LatestRateResponse,
  CurrencyConversion,
  CreateConversionDto,
  ListConversionsParams,
  SummaryParams,
  SummaryResponse,
  PaginatedResponse,
} from '../types/finance';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

class FinanceApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
    });

    // Add auth token to requests
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle 401 errors
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle token refresh or redirect to login
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // ============ Articles ============

  async getArticles(params?: ListArticlesParams): Promise<FinanceArticle[]> {
    const { data } = await this.api.get('/finance/articles', { params });
    return data;
  }

  async getArticle(id: string): Promise<FinanceArticle> {
    const { data } = await this.api.get(`/finance/articles/${id}`);
    return data;
  }

  async createArticle(dto: CreateArticleDto): Promise<FinanceArticle> {
    const { data } = await this.api.post('/finance/articles', dto);
    return data;
  }

  async updateArticle(id: string, dto: UpdateArticleDto): Promise<FinanceArticle> {
    const { data } = await this.api.patch(`/finance/articles/${id}`, dto);
    return data;
  }

  async deleteArticle(id: string): Promise<FinanceArticle> {
    const { data } = await this.api.delete(`/finance/articles/${id}`);
    return data;
  }

  // ============ Records ============

  async getRecords(params?: ListRecordsParams): Promise<PaginatedResponse<FinanceRecord>> {
    const { data } = await this.api.get('/finance/records', { params });
    return data;
  }

  async getRecord(id: string): Promise<FinanceRecord> {
    const { data } = await this.api.get(`/finance/records/${id}`);
    return data;
  }

  async createRecord(dto: CreateRecordDto): Promise<FinanceRecord> {
    const { data } = await this.api.post('/finance/records', dto);
    return data;
  }

  async updateRecord(id: string, dto: UpdateRecordDto): Promise<FinanceRecord> {
    const { data } = await this.api.patch(`/finance/records/${id}`, dto);
    return data;
  }

  async deleteRecord(id: string): Promise<FinanceRecord> {
    const { data } = await this.api.delete(`/finance/records/${id}`);
    return data;
  }

  // ============ Rates ============

  async getRates(params?: ListRatesParams): Promise<CurrencyRate[]> {
    const { data } = await this.api.get('/finance/rates', { params });
    return data;
  }

  async getLatestRate(params: LatestRateParams): Promise<LatestRateResponse> {
    const { data } = await this.api.get('/finance/rates/latest', { params });
    return data;
  }

  async createRate(dto: CreateRateDto): Promise<CurrencyRate> {
    const { data } = await this.api.post('/finance/rates', dto);
    return data;
  }

  // ============ Conversions ============

  async getConversions(params?: ListConversionsParams): Promise<PaginatedResponse<CurrencyConversion>> {
    const { data } = await this.api.get('/finance/conversions', { params });
    return data;
  }

  async getConversion(id: string): Promise<CurrencyConversion> {
    const { data } = await this.api.get(`/finance/conversions/${id}`);
    return data;
  }

  async createConversion(dto: CreateConversionDto): Promise<CurrencyConversion> {
    const { data } = await this.api.post('/finance/conversions', dto);
    return data;
  }

  async deleteConversion(id: string): Promise<CurrencyConversion> {
    const { data } = await this.api.delete(`/finance/conversions/${id}`);
    return data;
  }

  // ============ Summary ============

  async getSummary(params: SummaryParams): Promise<SummaryResponse> {
    const { data } = await this.api.get('/finance/summary', { params });
    return data;
  }
}

export const financeApi = new FinanceApiService();
```

---

## API Endpoints Reference

### Articles (Categories)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/finance/articles` | Create article |
| `GET` | `/finance/articles` | List articles |
| `GET` | `/finance/articles/:id` | Get single article |
| `PATCH` | `/finance/articles/:id` | Update article |
| `DELETE` | `/finance/articles/:id` | Delete/archive article |

**Query Parameters for List:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `kind` | `EXPENSE` \| `INCOME` | Filter by article type |
| `includeArchived` | `boolean` | Include archived articles (default: false) |

**Create/Update Body:**
```typescript
{
  kind: 'EXPENSE' | 'INCOME',  // Required on create, immutable
  name: string,                 // Required, max 100 chars
  color?: string                // Optional, e.g. "#FF5733"
}
```

---

### Records (Expenses/Incomes)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/finance/records` | Create record |
| `GET` | `/finance/records` | List records (paginated) |
| `GET` | `/finance/records/:id` | Get single record |
| `PATCH` | `/finance/records/:id` | Update record |
| `DELETE` | `/finance/records/:id` | Delete record |

**Query Parameters for List:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | `EXPENSE` \| `INCOME` | Filter by type |
| `currency` | `string` | Filter by currency (e.g., "USD") |
| `articleId` | `string` | Filter by article UUID |
| `from` | `string` | Start date (ISO format) |
| `to` | `string` | End date (ISO format) |
| `search` | `string` | Search in remark and article name |
| `page` | `number` | Page number (default: 1) |
| `limit` | `number` | Items per page (default: 20, max: 100) |
| `sortBy` | `string` | Sort field: `operationDate`, `createdAt`, `amount` |
| `sortOrder` | `string` | Sort direction: `asc`, `desc` |

**Create/Update Body:**
```typescript
{
  type: 'EXPENSE' | 'INCOME',   // Required
  amount: string,                // Required, e.g. "150.50"
  currency: string,              // Required, 3-letter ISO uppercase
  articleId?: string,            // Optional, must match type
  remark?: string,               // Optional, max 500 chars
  operationDate: string          // Required, ISO 8601
}
```

> **Important:** `amount` must be a string to preserve decimal precision. The backend validates format: `/^\d+(\.\d{1,4})?$/`

---

### Currency Rates

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/finance/rates` | Create rate |
| `GET` | `/finance/rates` | List rates |
| `GET` | `/finance/rates/latest` | Get latest rate for pair |

**Query Parameters for List:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `base` | `string` | Base currency filter |
| `quote` | `string` | Quote currency filter |
| `from` | `string` | From effective date |
| `to` | `string` | To effective date |

**Query Parameters for Latest:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `base` | `string` | **Required.** Base currency |
| `quote` | `string` | **Required.** Quote currency |
| `asOf` | `string` | Target date (default: now) |

**Create Body:**
```typescript
{
  baseCurrency: string,    // Required, e.g. "USD"
  quoteCurrency: string,   // Required, e.g. "EUR"
  rate: string,            // Required, e.g. "0.92"
  source?: string,         // Optional, e.g. "manual"
  effectiveAt: string      // Required, ISO 8601
}
```

**Latest Rate Response:**
```typescript
{
  rate: CurrencyRate,      // The actual rate record
  effectiveRate: string,   // The rate to use (may be inverted)
  isInverse: boolean       // True if rate was inverted
}
```

---

### Currency Conversions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/finance/conversions` | Create conversion |
| `GET` | `/finance/conversions` | List conversions (paginated) |
| `GET` | `/finance/conversions/:id` | Get single conversion |
| `DELETE` | `/finance/conversions/:id` | Delete conversion |

**Query Parameters for List:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `fromCurrency` | `string` | Filter by source currency |
| `toCurrency` | `string` | Filter by target currency |
| `from` | `string` | From operation date |
| `to` | `string` | To operation date |
| `page` | `number` | Page number |
| `limit` | `number` | Items per page |

**Create Body:**
```typescript
{
  fromAmount: string,      // Required, e.g. "100.00"
  fromCurrency: string,    // Required, e.g. "USD"
  toCurrency: string,      // Required, e.g. "EUR"
  operationDate: string,   // Required, ISO 8601
  feeAmount?: string,      // Optional conversion fee
  feeCurrency?: string,    // Optional fee currency
  remark?: string          // Optional note
}
```

> **Note:** The `toAmount` and `rateUsed` are calculated automatically based on the rate effective at `operationDate`.

**Error Response (422):**
```json
{
  "statusCode": 422,
  "message": "No FX rate found for USD/XYZ at 2024-01-15T00:00:00.000Z"
}
```

---

### Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/finance/summary` | Get financial summary |

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `from` | `string` | **Required.** Start date |
| `to` | `string` | **Required.** End date |
| `baseCurrency` | `string` | Optional. Convert totals to this currency |

**Response:**
```typescript
{
  income: {
    "USD": "5000.00",
    "EUR": "1200.00"
  },
  expense: {
    "USD": "1500.00",
    "EUR": "300.00"
  },
  conversionFees: {        // Only if fees exist
    "USD": "15.00"
  },
  // Only if baseCurrency provided:
  incomeBaseCurrency: "6104.00",
  expenseBaseCurrency: "1776.00",
  netBaseCurrency: "4328.00"
}
```

---

## React Hooks Examples

### useArticles Hook

```typescript
// hooks/useArticles.ts
import { useState, useEffect, useCallback } from 'react';
import { financeApi } from '../services/financeApi';
import { FinanceArticle, FinanceArticleKind, CreateArticleDto } from '../types/finance';

export function useArticles(kind?: FinanceArticleKind) {
  const [articles, setArticles] = useState<FinanceArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArticles = useCallback(async () => {
    try {
      setLoading(true);
      const data = await financeApi.getArticles({ kind, includeArchived: false });
      setArticles(data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch articles');
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const createArticle = async (dto: CreateArticleDto) => {
    const newArticle = await financeApi.createArticle(dto);
    setArticles((prev) => [...prev, newArticle]);
    return newArticle;
  };

  const deleteArticle = async (id: string) => {
    await financeApi.deleteArticle(id);
    setArticles((prev) => prev.filter((a) => a.id !== id));
  };

  return {
    articles,
    loading,
    error,
    refetch: fetchArticles,
    createArticle,
    deleteArticle,
  };
}
```

### useRecords Hook with Pagination

```typescript
// hooks/useRecords.ts
import { useState, useEffect, useCallback } from 'react';
import { financeApi } from '../services/financeApi';
import { FinanceRecord, ListRecordsParams, PaginatedResponse } from '../types/finance';

export function useRecords(initialParams?: ListRecordsParams) {
  const [data, setData] = useState<PaginatedResponse<FinanceRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<ListRecordsParams>(initialParams || {});

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const response = await financeApi.getRecords(params);
      setData(response);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch records');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const setPage = (page: number) => {
    setParams((prev) => ({ ...prev, page }));
  };

  const setFilters = (filters: Partial<ListRecordsParams>) => {
    setParams((prev) => ({ ...prev, ...filters, page: 1 }));
  };

  return {
    records: data?.results || [],
    pagination: {
      currentPage: data?.current_page || 1,
      totalPages: data?.total_pages || 1,
      totalCount: data?.count || 0,
      hasNext: !!data?.next,
      hasPrev: !!data?.previous,
    },
    loading,
    error,
    params,
    setPage,
    setFilters,
    refetch: fetchRecords,
  };
}
```

### useSummary Hook

```typescript
// hooks/useSummary.ts
import { useState, useEffect } from 'react';
import { financeApi } from '../services/financeApi';
import { SummaryResponse, SummaryParams } from '../types/finance';

export function useSummary(params: SummaryParams) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const data = await financeApi.getSummary(params);
        setSummary(data);
        setError(null);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch summary');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [params.from, params.to, params.baseCurrency]);

  return { summary, loading, error };
}
```

---

## Form Validation

### Record Form with Yup

```typescript
// validation/recordSchema.ts
import * as yup from 'yup';

export const recordSchema = yup.object({
  type: yup
    .string()
    .oneOf(['EXPENSE', 'INCOME'])
    .required('Type is required'),
  amount: yup
    .string()
    .required('Amount is required')
    .matches(/^\d+(\.\d{1,4})?$/, 'Invalid amount format'),
  currency: yup
    .string()
    .required('Currency is required')
    .matches(/^[A-Z]{3}$/, 'Must be 3-letter uppercase code'),
  articleId: yup.string().uuid().nullable(),
  remark: yup.string().max(500).nullable(),
  operationDate: yup
    .string()
    .required('Date is required')
    .test('is-date', 'Invalid date', (value) => !isNaN(Date.parse(value || ''))),
});
```

### Article Form with Yup

```typescript
// validation/articleSchema.ts
import * as yup from 'yup';

export const articleSchema = yup.object({
  kind: yup
    .string()
    .oneOf(['EXPENSE', 'INCOME'])
    .required('Kind is required'),
  name: yup
    .string()
    .required('Name is required')
    .max(100, 'Name too long'),
  color: yup
    .string()
    .matches(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color')
    .nullable(),
});
```

---

## Error Handling

### API Error Types

```typescript
// types/errors.ts
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export function isApiError(error: any): error is { response: { data: ApiError } } {
  return error?.response?.data?.statusCode !== undefined;
}

export function getErrorMessage(error: any): string {
  if (isApiError(error)) {
    const { message } = error.response.data;
    return Array.isArray(message) ? message[0] : message;
  }
  return error.message || 'An unexpected error occurred';
}
```

### Common Error Codes

| Status | Meaning | Common Causes |
|--------|---------|---------------|
| `400` | Bad Request | Validation failed (check `message` array) |
| `401` | Unauthorized | Token expired or invalid |
| `404` | Not Found | Resource doesn't exist or belongs to another user |
| `409` | Conflict | Duplicate article name for same kind |
| `422` | Unprocessable | No FX rate found for conversion |

### Error Handling Component

```tsx
// components/ErrorAlert.tsx
import React from 'react';
import { getErrorMessage } from '../types/errors';

interface Props {
  error: any;
  onRetry?: () => void;
}

export const ErrorAlert: React.FC<Props> = ({ error, onRetry }) => {
  const message = getErrorMessage(error);

  return (
    <div className="error-alert">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry}>Retry</button>
      )}
    </div>
  );
};
```

---

## Utility Functions

### Currency Formatting

```typescript
// utils/currency.ts

export function formatMoney(amount: string, currency: string): string {
  const num = parseFloat(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

// Convert number to API string format
export function toAmountString(value: number): string {
  return value.toFixed(4).replace(/\.?0+$/, '') || '0';
}

// Parse API string to number for calculations
export function parseAmount(value: string): number {
  return parseFloat(value) || 0;
}
```

### Date Formatting

```typescript
// utils/date.ts

export function toISOString(date: Date): string {
  return date.toISOString();
}

export function toDateInputValue(isoString: string): string {
  return isoString.split('T')[0];
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
```

---

## Example Components

### Quick Record Form

```tsx
// components/QuickRecordForm.tsx
import React, { useState } from 'react';
import { financeApi } from '../services/financeApi';
import { CreateRecordDto, FinanceRecordType } from '../types/finance';
import { toAmountString, toISOString } from '../utils';

interface Props {
  type: FinanceRecordType;
  onSuccess: () => void;
}

export const QuickRecordForm: React.FC<Props> = ({ type, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const dto: CreateRecordDto = {
        type,
        amount: toAmountString(parseFloat(amount)),
        currency: currency.toUpperCase(),
        operationDate: toISOString(new Date()),
      };

      await financeApi.createRecord(dto);
      setAmount('');
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create record');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="number"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        required
      />
      <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
        <option value="USD">USD</option>
        <option value="EUR">EUR</option>
        <option value="TMT">TMT</option>
      </select>
      <button type="submit" disabled={loading}>
        {loading ? 'Saving...' : `Add ${type}`}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
};
```

---

## Notes

1. **Money as Strings**: Always send and receive money values as strings to avoid floating-point precision issues.

2. **Currency Codes**: Always uppercase, 3 letters (ISO 4217).

3. **Dates**: Use ISO 8601 format for all date fields.

4. **Article-Record Matching**: When linking a record to an article, the article's `kind` must match the record's `type`.

5. **Soft Delete**: Deleting an article with existing records will archive it (set `isArchived: true`) instead of physically deleting.

6. **Rate Lookup**: When creating conversions, the API automatically finds the appropriate rate. If no rate exists, it returns 422.

7. **User Scoping**: All data is automatically scoped to the authenticated user. Users cannot access other users' data.

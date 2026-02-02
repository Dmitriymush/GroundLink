# API Refactoring Documentation

## Overview

This document outlines the refactoring of the API layer to use a unified approach with TanStack Query and a single HTTP client (Axios) instead of multiple HTTP libraries (needle, axios).

## Key Changes

### 1. Unified HTTP Client
- **Before**: Mixed usage of `needle` and `axios` across different controllers
- **After**: Single `HttpClient` class using Axios with consistent error handling and logging

### 2. Service Layer Architecture
- **Before**: Direct API calls in controllers with inconsistent patterns
- **After**: Organized service classes extending `BaseApiService` with TanStack Query integration

### 3. TanStack Query Integration
- **Before**: Manual query management and inconsistent caching
- **After**: Centralized query management with automatic caching, retries, and invalidation

## New Architecture

### Directory Structure
```
src/
├── services/
│   └── api/
│       ├── types.ts              # Common API types and interfaces
│       ├── http-client.ts        # Unified HTTP client
│       ├── base-service.ts       # Base service class
│       ├── rpanion-service.ts    # RPanion API service
│       ├── vulic-service.ts      # Vulic API service
│       └── index.ts              # Service factory and exports
├── hooks/
│   ├── use-rpanion-api.ts        # RPanion TanStack Query hooks
│   └── use-vulic-api.ts          # Vulic TanStack Query hooks
```

### Core Components

#### 1. HttpClient (`src/services/api/http-client.ts`)
```typescript
import { HttpClient } from '@/services/api';

const client = new HttpClient({
  baseURL: 'http://api.example.com',
  timeout: 10000,
  debug: true
});

// Methods: get, post, put, delete, patch, ping
const data = await client.get('/users');
```

#### 2. BaseApiService (`src/services/api/base-service.ts`)
```typescript
export abstract class BaseApiService {
  protected http: HttpClient;
  
  // Helper methods for TanStack Query integration
  protected createQueryKey(baseKey: string, params?: Record<string, any>): string[]
  protected createQueryFunction<T>(fn: () => Promise<T>): () => Promise<T>
  protected createMutationFunction<TData, TVariables>(fn: (variables: TVariables) => Promise<TData>)
}
```

#### 3. Service Factory (`src/services/api/index.ts`)
```typescript
import { ApiServiceFactory } from '@/services/api';

// Create service instances with automatic caching
const rpanionService = ApiServiceFactory.createRPanionService('http://10.0.2.100:3000');
const vulicService = ApiServiceFactory.createVulicService('127.0.0.1', 8000);
```

## Usage Examples

### 1. Using TanStack Query Hooks

#### RPanion API
```typescript
import { useRPanionConnection, useRPanionVideoSettings, useUpdateRPanionVideoSettings } from '@/hooks/use-rpanion-api';

// In a Vue component
const { data: isConnected, isLoading } = useRPanionConnection('http://10.0.2.100:3000');
const { data: videoSettings, refetch } = useRPanionVideoSettings();
const { mutate: updateSettings, isPending } = useUpdateRPanionVideoSettings();

// Update video settings
updateSettings({
  width: 1920,
  height: 1080,
  fps: '30'
});
```

#### Vulic API
```typescript
import { useVulicConnection, useChangeVulicRelayState } from '@/hooks/use-vulic-api';

// In a Vue component
const { data: isConnected } = useVulicConnection('127.0.0.1', 8000);
const { mutate: changeRelay, isPending } = useChangeVulicRelayState();

// Change relay state
changeRelay({ relay: 1, state: true });
```

### 2. Direct Service Usage

```typescript
import { createRPanionService, createVulicService } from '@/services/api';

// Create service instances
const rpanionService = createRPanionService('http://10.0.2.100:3000');
const vulicService = createVulicService('127.0.0.1', 8000);

// Use services directly
const videoSettings = await rpanionService.getVideoSettings();
await vulicService.changeRelayState(1, true);
```

### 3. Migration from Old Controllers

#### Before (using needle)
```typescript
import needle from 'needle';

// In rpanion.ts
const { body } = await needle('get', `http://${ip}:3000/api/FCDetails`);
```

#### After (using unified service)
```typescript
import { useRPanionFCDetails } from '@/hooks/use-rpanion-api';

// In Vue component
const { data: fcDetails } = useRPanionFCDetails('http://10.0.2.100:3000');
```

## Benefits

### 1. Consistency
- Single HTTP client with consistent error handling
- Uniform API patterns across all services
- Standardized logging and debugging

### 2. Performance
- Automatic caching with TanStack Query
- Intelligent background refetching
- Optimistic updates for better UX

### 3. Developer Experience
- Type-safe API calls with TypeScript
- Automatic query invalidation
- Built-in loading and error states

### 4. Maintainability
- Centralized service logic
- Easy to add new API endpoints
- Consistent error handling and retry logic

## Migration Guide

### Step 1: Replace Direct API Calls
```typescript
// Old way
import { isAvalible } from '@/controllers/rpanion';
const status = await isAvalible(host);

// New way
import { useRPanionConnection } from '@/hooks/use-rpanion-api';
const { data: status } = useRPanionConnection(host);
```

### Step 2: Update Query Keys
```typescript
// Old way
const { data } = useQuery({
  queryKey: [QUERIES.CONNECTIONS_STATUS, storageHost],
  queryFn: ({queryKey}) => isAvalible(queryKey[1]),
});

// New way
const { data } = useRPanionConnection(storageHost.value);
```

### Step 3: Replace Mutations
```typescript
// Old way
const { mutate } = useMutation({
  mutationFn: (settings) => changeVideoSettingsApi(settings),
});

// New way
const { mutate } = useUpdateRPanionVideoSettings();
```

## Configuration

### Environment Variables
```typescript
// Development
const service = createRPanionService('http://localhost:3000');

// Production
const service = createRPanionService('http://10.0.2.100:3000');
```

### Debug Mode
```typescript
// Enable debug logging
const service = createRPanionService('http://10.0.2.100:3000');
service.setDebugMode(true);
```

## Error Handling

The new architecture provides consistent error handling:

```typescript
const { data, error, isError } = useRPanionConnection();

if (isError.value) {
  console.error('Connection failed:', error.value);
}
```

## Testing

### Unit Testing Services
```typescript
import { RPanionService } from '@/services/api/rpanion-service';

const service = new RPanionService({
  baseURL: 'http://test-api.com',
  debug: false
});

// Test service methods
expect(await service.checkConnection()).toBe(true);
```

### Integration Testing
```typescript
import { useRPanionConnection } from '@/hooks/use-rpanion-api';

// Test hooks with mock services
const { data, isLoading } = useRPanionConnection('http://test-api.com');
```

## Future Enhancements

1. **Request/Response Interceptors**: Add authentication, logging, and monitoring
2. **Offline Support**: Implement offline caching and sync
3. **Real-time Updates**: Add WebSocket support for live data
4. **API Versioning**: Support for multiple API versions
5. **Rate Limiting**: Implement request throttling and retry logic

## Troubleshooting

### Common Issues

1. **Query Not Refetching**: Check if `enabled` is set to `false`
2. **Cache Not Updating**: Ensure proper query invalidation in mutations
3. **Type Errors**: Verify TypeScript types are properly imported

### Debug Tips

1. Enable debug mode to see HTTP requests/responses
2. Use TanStack Query DevTools for cache inspection
3. Check browser network tab for failed requests

## Conclusion

This refactoring provides a more maintainable, performant, and developer-friendly API layer. The unified approach with TanStack Query ensures consistent data fetching patterns across the application while providing excellent caching and synchronization capabilities.

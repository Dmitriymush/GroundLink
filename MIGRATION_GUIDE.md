# API Migration Guide

## Summary
- Total files analyzed: 122
- Files requiring migration: 14
- Total issues to fix: 20

## Migration Steps

### 1. Replace Needle Usage
Files with needle imports: 3
Files with needle usage: 3

**Before:**
```typescript
import needle from 'needle';
const { body } = await needle('get', `http://${ip}:3000/api/FCDetails`);
```

**After:**
```typescript
import { useRPanionFCDetails } from '@/hooks/use-rpanion-api';
const { data } = useRPanionFCDetails(ip);
```

### 2. Replace Old Controller Imports
Files with old rpanion imports: 0
Files with old vulic imports: 0

**Before:**
```typescript
import { isAvalible } from '@/controllers/rpanion';
import { vulicApi } from '@/controllers/vulic';
```

**After:**
```typescript
import { useRPanionConnection } from '@/hooks/use-rpanion-api';
import { useVulicConnection } from '@/hooks/use-vulic-api';
```

### 3. Replace Old Query Keys
Files with old query keys: 0

**Before:**
```typescript
const { data } = useQuery({
  queryKey: [QUERIES.CONNECTIONS_STATUS, storageHost],
  queryFn: ({queryKey}) => isAvalible(queryKey[1]),
});
```

**After:**
```typescript
const { data } = useRPanionConnection(storageHost.value);
```

## Files to Migrate


### src/components/pages/BombPage.vue
- Line 108: Found old intiatorApi calls - should use new hooks


### src/controllers/api/base-api.ts
- Line 5: Found needle import - should be replaced with unified HTTP client
- Line 61: Found needle usage - should be replaced with service methods


### src/controllers/api/index.ts
- Line 7: Found old MegaServerApi usage - should use new MegaServerService
- Line 9: Found old VulikApi usage - should use new VulikApiService
- Line 8: Found old ModemControllApi usage - should use new ModemControlService
- Line 10: Found old InitiatorApi usage - should use new InitiatorService


### src/controllers/api/initiator-api.ts
- Line 26: Found old BaseApi usage - should use new BaseApiService


### src/controllers/api/mega-server-api.ts
- Line 7: Found old BaseApi usage - should use new BaseApiService


### src/controllers/api/modem-controll-api.ts
- Line 13: Found old BaseApi usage - should use new BaseApiService


### src/controllers/api/vulik-api.ts
- Line 61: Found old BaseApi usage - should use new BaseApiService


### src/controllers/rpanion.ts
- Line 10: Found needle import - should be replaced with unified HTTP client
- Line 216: Found needle usage - should be replaced with service methods


### src/controllers/vulic.ts
- Line 5: Found needle import - should be replaced with unified HTTP client
- Line 0: Found needle usage - should be replaced with service methods


### src/services/api/drone-service.ts
- Line 62: Found old BaseApi usage - should use new BaseApiService


### src/services/api/hardware-service.ts
- Line 39: Found old BaseApi usage - should use new BaseApiService


### src/services/api/initiator-service.ts
- Line 33: Found old BaseApi usage - should use new BaseApiService


### src/services/api/mega-server-service.ts
- Line 26: Found old BaseApi usage - should use new BaseApiService


### src/services/api/rpanion-service.ts
- Line 106: Found old BaseApi usage - should use new BaseApiService


## Next Steps

1. Review each file listed above
2. Replace old patterns with new unified API approach
3. Test functionality after each migration
4. Remove unused imports and dependencies
5. Update tests to use new API patterns

## Benefits After Migration

- ✅ Consistent error handling
- ✅ Automatic caching with TanStack Query
- ✅ Type-safe API calls
- ✅ Better performance with intelligent refetching
- ✅ Easier testing and maintenance

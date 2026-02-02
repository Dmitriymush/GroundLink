#!/usr/bin/env node

/**
 * API Migration Script
 * 
 * This script helps identify and migrate old API usage patterns to the new unified approach.
 * Run with: node scripts/migrate-api.js
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patterns to search for
const OLD_PATTERNS = {
  needle: {
    imports: /import\s+needle\s+from\s+['"]needle['"]/g,
    usage: /needle\s*\(\s*['"](get|post|put|delete|patch)['"]\s*,\s*([^,]+)/g,
  },
  fetch: {
    usage: /await\s+fetch\s*\(/g,
  },
  oldControllers: {
    rpanion: /from\s+['"]@\/controllers\/rpanion['"]/g,
    vulic: /from\s+['"]@\/controllers\/vulic['"]/g,
    megaServer: /from\s+['"]@\/controllers\/api['"]/g,
  },
  oldApiServices: {
    baseApi: /extends\s+BaseApi/g,
    megaServerApi: /new\s+MegaServerApi/g,
    vulikApi: /new\s+VulikApi/g,
    modemControllApi: /new\s+ModemControllApi/g,
    intiatorApi: /new\s+InitiatorApi/g,
  },
  oldQueryKeys: {
    queries: /QUERIES\./g,
    connectionStatus: /CONNECTIONS_STATUS/g,
  },
  oldApiCalls: {
    megaServerApi: /megaServerApi\./g,
    vulikApi: /vulikApi\./g,
    modemControllApi: /modemControllApi\./g,
    intiatorApi: /intiatorApi\./g,
  }
};

// New patterns to replace with
const NEW_PATTERNS = {
  imports: {
    rpanionHooks: "import { useRPanionConnection, useRPanionVideoSettings } from '@/hooks/use-rpanion-api';",
    hardwareHooks: "import { useHardwareConnection, useChangeRelayState, useModemState } from '@/hooks/use-hardware-api';",
    droneHooks: "import { useDroneConnection, useDrones, useChangeDroneLeadState } from '@/hooks/use-drone-api';",
    unifiedApi: "import { createRPanionService, createHardwareService, createDroneService } from '@/services/api';",
  },
  replacements: {
    needleImport: "// TODO: Replace needle with unified HTTP client",
    oldRpanionImport: "// TODO: Replace with useRPanionConnection hook",
    oldVulicImport: "// TODO: Replace with useHardwareConnection hook",
    oldVulikImport: "// TODO: Replace with useDroneConnection hook",
    oldMegaServerImport: "// TODO: Replace with useHardwareConnection hook",
    oldModemImport: "// TODO: Replace with useModemState hook",
  }
};

function findFiles(pattern) {
  return glob.sync(pattern, { 
    cwd: process.cwd(),
    ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
  });
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  
  // Check for needle usage
  if (OLD_PATTERNS.needle.imports.test(content)) {
    issues.push({
      type: 'needle_import',
      message: 'Found needle import - should be replaced with unified HTTP client',
      line: content.split('\n').findIndex(line => OLD_PATTERNS.needle.imports.test(line)) + 1
    });
  }
  
  if (OLD_PATTERNS.needle.usage.test(content)) {
    issues.push({
      type: 'needle_usage',
      message: 'Found needle usage - should be replaced with service methods',
      line: content.split('\n').findIndex(line => OLD_PATTERNS.needle.usage.test(line)) + 1
    });
  }

  // Check for fetch usage
  if (OLD_PATTERNS.fetch.usage.test(content)) {
    issues.push({
      type: 'fetch_usage',
      message: 'Found fetch usage - should be replaced with unified HTTP client',
      line: content.split('\n').findIndex(line => OLD_PATTERNS.fetch.usage.test(line)) + 1
    });
  }
  
  // Check for old controller imports
  if (OLD_PATTERNS.oldControllers.rpanion.test(content)) {
    issues.push({
      type: 'old_rpanion_import',
      message: 'Found old rpanion controller import - should use new hooks',
      line: content.split('\n').findIndex(line => OLD_PATTERNS.oldControllers.rpanion.test(line)) + 1
    });
  }
  
  if (OLD_PATTERNS.oldControllers.vulic.test(content)) {
    issues.push({
      type: 'old_vulic_import',
      message: 'Found old vulic controller import - should use new hooks',
      line: content.split('\n').findIndex(line => OLD_PATTERNS.oldControllers.vulic.test(line)) + 1
    });
  }

  if (OLD_PATTERNS.oldControllers.megaServer.test(content)) {
    issues.push({
      type: 'old_api_import',
      message: 'Found old API controllers import - should use new unified services',
      line: content.split('\n').findIndex(line => OLD_PATTERNS.oldControllers.megaServer.test(line)) + 1
    });
  }

  // Check for old API service usage
  if (OLD_PATTERNS.oldApiServices.baseApi.test(content)) {
    issues.push({
      type: 'old_base_api',
      message: 'Found old BaseApi usage - should use new BaseApiService',
      line: content.split('\n').findIndex(line => OLD_PATTERNS.oldApiServices.baseApi.test(line)) + 1
    });
  }

  if (OLD_PATTERNS.oldApiServices.megaServerApi.test(content)) {
    issues.push({
      type: 'old_mega_server_api',
      message: 'Found old MegaServerApi usage - should use new MegaServerService',
      line: content.split('\n').findIndex(line => OLD_PATTERNS.oldApiServices.megaServerApi.test(line)) + 1
    });
  }

  if (OLD_PATTERNS.oldApiServices.vulikApi.test(content)) {
    issues.push({
      type: 'old_vulik_api',
      message: 'Found old VulikApi usage - should use new VulikApiService',
      line: content.split('\n').findIndex(line => OLD_PATTERNS.oldApiServices.vulikApi.test(line)) + 1
    });
  }

  if (OLD_PATTERNS.oldApiServices.modemControllApi.test(content)) {
    issues.push({
      type: 'old_modem_control_api',
      message: 'Found old ModemControllApi usage - should use new ModemControlService',
      line: content.split('\n').findIndex(line => OLD_PATTERNS.oldApiServices.modemControllApi.test(line)) + 1
    });
  }

  if (OLD_PATTERNS.oldApiServices.intiatorApi.test(content)) {
    issues.push({
      type: 'old_initiator_api',
      message: 'Found old InitiatorApi usage - should use new InitiatorService',
      line: content.split('\n').findIndex(line => OLD_PATTERNS.oldApiServices.intiatorApi.test(line)) + 1
    });
  }

  // Check for old API calls
  if (OLD_PATTERNS.oldApiCalls.megaServerApi.test(content)) {
    issues.push({
      type: 'old_mega_server_calls',
      message: 'Found old megaServerApi calls - should use new hooks',
      line: content.split('\n').findIndex(line => OLD_PATTERNS.oldApiCalls.megaServerApi.test(line)) + 1
    });
  }

  if (OLD_PATTERNS.oldApiCalls.vulikApi.test(content)) {
    issues.push({
      type: 'old_vulik_api_calls',
      message: 'Found old vulikApi calls - should use new hooks',
      line: content.split('\n').findIndex(line => OLD_PATTERNS.oldApiCalls.vulikApi.test(line)) + 1
    });
  }

  if (OLD_PATTERNS.oldApiCalls.modemControllApi.test(content)) {
    issues.push({
      type: 'old_modem_control_calls',
      message: 'Found old modemControllApi calls - should use new hooks',
      line: content.split('\n').findIndex(line => OLD_PATTERNS.oldApiCalls.modemControllApi.test(line)) + 1
    });
  }

  if (OLD_PATTERNS.oldApiCalls.intiatorApi.test(content)) {
    issues.push({
      type: 'old_initiator_calls',
      message: 'Found old intiatorApi calls - should use new hooks',
      line: content.split('\n').findIndex(line => OLD_PATTERNS.oldApiCalls.intiatorApi.test(line)) + 1
    });
  }
  
  // Check for old query keys
  if (OLD_PATTERNS.oldQueryKeys.queries.test(content)) {
    issues.push({
      type: 'old_query_keys',
      message: 'Found old QUERIES constant usage - should use service query keys',
      line: content.split('\n').findIndex(line => OLD_PATTERNS.oldQueryKeys.queries.test(line)) + 1
    });
  }
  
  return issues;
}

function generateMigrationReport() {
  console.log('🔍 Analyzing API usage patterns...\n');
  
  const vueFiles = findFiles('src/**/*.vue');
  const tsFiles = findFiles('src/**/*.ts');
  const allFiles = [...vueFiles, ...tsFiles];
  
  const report = {
    totalFiles: allFiles.length,
    filesWithIssues: 0,
    totalIssues: 0,
    issuesByType: {},
    files: []
  };
  
  allFiles.forEach(file => {
    const issues = analyzeFile(file);
    
    if (issues.length > 0) {
      report.filesWithIssues++;
      report.totalIssues += issues.length;
      report.files.push({
        path: file,
        issues
      });
      
      issues.forEach(issue => {
        report.issuesByType[issue.type] = (report.issuesByType[issue.type] || 0) + 1;
      });
    }
  });
  
  return report;
}

function printReport(report) {
  console.log('📊 Migration Report\n');
  console.log(`Total files analyzed: ${report.totalFiles}`);
  console.log(`Files with issues: ${report.filesWithIssues}`);
  console.log(`Total issues found: ${report.totalIssues}\n`);
  
  console.log('Issues by type:');
  Object.entries(report.issuesByType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  
  console.log('\nFiles requiring migration:');
  report.files.forEach(file => {
    console.log(`\n📁 ${file.path}`);
    file.issues.forEach(issue => {
      console.log(`  Line ${issue.line}: ${issue.message}`);
    });
  });
}

function generateMigrationGuide(report) {
  const guide = `# API Migration Guide

## Summary
- Total files analyzed: ${report.totalFiles}
- Files requiring migration: ${report.filesWithIssues}
- Total issues to fix: ${report.totalIssues}

## Migration Steps

### 1. Replace Needle Usage
Files with needle imports: ${report.issuesByType.needle_import || 0}
Files with needle usage: ${report.issuesByType.needle_usage || 0}

**Before:**
\`\`\`typescript
import needle from 'needle';
const { body } = await needle('get', \`http://\${ip}:3000/api/FCDetails\`);
\`\`\`

**After:**
\`\`\`typescript
import { useRPanionFCDetails } from '@/hooks/use-rpanion-api';
const { data } = useRPanionFCDetails(ip);
\`\`\`

### 2. Replace Old Controller Imports
Files with old rpanion imports: ${report.issuesByType.old_rpanion_import || 0}
Files with old vulic imports: ${report.issuesByType.old_vulic_import || 0}

**Before:**
\`\`\`typescript
import { isAvalible } from '@/controllers/rpanion';
import { vulicApi } from '@/controllers/vulic';
\`\`\`

**After:**
\`\`\`typescript
import { useRPanionConnection } from '@/hooks/use-rpanion-api';
import { useVulicConnection } from '@/hooks/use-vulic-api';
\`\`\`

### 3. Replace Old Query Keys
Files with old query keys: ${report.issuesByType.old_query_keys || 0}

**Before:**
\`\`\`typescript
const { data } = useQuery({
  queryKey: [QUERIES.CONNECTIONS_STATUS, storageHost],
  queryFn: ({queryKey}) => isAvalible(queryKey[1]),
});
\`\`\`

**After:**
\`\`\`typescript
const { data } = useRPanionConnection(storageHost.value);
\`\`\`

## Files to Migrate

${report.files.map(file => `
### ${file.path}
${file.issues.map(issue => `- Line ${issue.line}: ${issue.message}`).join('\n')}
`).join('\n')}

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
`;

  fs.writeFileSync('MIGRATION_GUIDE.md', guide);
  console.log('\n📝 Migration guide saved to MIGRATION_GUIDE.md');
}

// Main execution
if (require.main === module) {
  try {
    const report = generateMigrationReport();
    printReport(report);
    generateMigrationGuide(report);
    
    if (report.totalIssues > 0) {
      console.log('\n🚀 Ready to start migration! Check MIGRATION_GUIDE.md for detailed instructions.');
    } else {
      console.log('\n✅ No migration issues found! Your codebase is already using the new unified API.');
    }
  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
    process.exit(1);
  }
}

module.exports = {
  analyzeFile,
  generateMigrationReport,
  printReport,
  generateMigrationGuide
};

import inquirer from "inquirer";
import fs from "fs";
import path from "path";
import { FEATURES } from "../constants/features";

// Convert enum to array of values
const FEATURE_VALUES = Object.values(FEATURES);

const CHANNELS = Array.from({ length: 16 }, (_, i) => `CH${i + 1}`);

type BuildConfig = {
  features: string[];
  ignoreSecure: boolean;
  manualChannels: string[];
  vulikPresets: string;
  versionPrefix?: string;
};

async function promptConfig(): Promise<BuildConfig> {
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "versionPrefix",
      message: "Enter version prefix (optional, press enter to skip):",
      default: "",
      validate: (input) => {
        if (!input) return true; // Empty is valid
        return (
          /^[a-zA-Z0-9-]+$/.test(input) ||
          "Prefix must contain only letters, numbers, and hyphens"
        );
      },
    },
    {
      type: "checkbox",
      name: "features",
      message: "Select features to include:",
      choices: [{ name: "All Features", value: "all" }, ...FEATURE_VALUES],
      validate: (input) => {
        if (input.includes("all")) {
          return true;
        }
        return input.length > 0 || "Select at least one feature";
      },
    },
    {
      type: "confirm",
      name: "ignoreSecure",
      message: "Enable IGNORE_SECURE?",
      default: false,
    },
    {
      type: "checkbox",
      name: "manualChannels",
      message: "Select manual channels:",
      choices: CHANNELS,
    },
    {
      type: "input",
      name: "vulikPresets",
      message:
        "Enter Vulik presets (format: name:host:port,name2:host2:port2):",
      default: "default:localhost:3003",
      validate: (input) => {
        const pattern =
          /^[a-zA-Z0-9]+:[a-zA-Z0-9.]+:\d+(,[a-zA-Z0-9]+:[a-zA-Z0-9.]+:\d+)*$/;
        return (
          pattern.test(input) ||
          "Invalid format. Use name:host:port,name2:host2:port2"
        );
      },
    },
  ]);

  return answers;
}

async function backupFiles() {
  const files = [".env", "package.json"];
  for (const file of files) {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, `${file}.backup`);
    }
  }
}

async function restoreFiles() {
  const files = [".env", "package.json"];
  for (const file of files) {
    if (fs.existsSync(`${file}.backup`)) {
      fs.copyFileSync(`${file}.backup`, file);
      fs.unlinkSync(`${file}.backup`);
    }
  }
}

function updatePackageJson(
  features: string[],
  ignoreSecure: boolean,
  versionPrefix?: string
) {
  const pkgPath = path.join(process.cwd(), "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  // Update version
  const [major, minor, patch] = pkg.version.split("-")[0].split(".");

  console.log("features", features);

  // Determine feature suffix
  let featureSuffix;
  if (features.includes("all") || features.length >= FEATURE_VALUES.length) {
    featureSuffix = "all";
  } else {
    featureSuffix = features.map((f) => f.substring(0, 3)).join("-");
  }

  // Add secure/insecure label
  const securityLabel = ignoreSecure ? "-insecure" : "-secure";

  const baseVersion = `${major}.${minor}.${parseInt(patch) + 1}`;
  const suffixes = [featureSuffix, securityLabel, versionPrefix].filter(
    Boolean
  );
  pkg.version = `${baseVersion}-${suffixes.join("-")}`;

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
}

function updateEnvFile(config: BuildConfig) {
  const envContent = [
    `VITE_APP_BUILD_FEATURES="${config.features.join(",")}"`,
    `VITE_APP_INGORE_SECURE="${config.ignoreSecure ? "" : "FALSE"}"`,
    `VITE_APP_MANUAL_CHANNELS="${config.manualChannels.join(",")}"`,
    `VITE_APP_VULIK_PRESETS="${config.vulikPresets}"`,
  ].join("\n");

  fs.writeFileSync(".env", envContent);
}

let filesModified = false;

// Handle process termination
process.on("SIGINT", async () => {
  console.log("\nProcess interrupted by user");
  if (filesModified) {
    console.log("Rolling back changes...");
    await restoreFiles();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nProcess terminated");
  if (filesModified) {
    console.log("Rolling back changes...");
    await restoreFiles();
  }
  process.exit(0);
});

async function main() {
  try {
    console.log("Starting build configuration...");

    // Get configuration from user
    const config = await promptConfig();

    // Backup files and set modified flag
    await backupFiles();

    filesModified = true;

    // Process features if "all" is selected
    if (config.features.includes("all")) {
      config.features = FEATURE_VALUES;
    }

    console.log("Updating configuration files...");

    // Update files
    updateEnvFile(config);
    updatePackageJson(
      config.features,
      config.ignoreSecure,
      config.versionPrefix
    );

    // Run build
    console.log("Running build...");
    const { execSync } = require("child_process");
    execSync("npm run build", { stdio: "inherit" });

    // Restore files and reset modified flag
    await restoreFiles();
    filesModified = false;

    console.log("Build completed successfully!");
  } catch (error) {
    console.error("Error:", error);
    if (filesModified) {
      console.log("Rolling back changes due to error...");
      await restoreFiles();
      filesModified = false;
    }
    process.exit(1);
  }
}

main();

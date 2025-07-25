#!/bin/zsh
#
# Script to package Chrome extension into a versioned zip file
# Requires: jq, zip, git

set -e  # Exit immediately if a command exits with non-zero status

# Constants
MANIFEST_FILE="manifest.json"
OUTPUT_DIR="output"

# Check dependencies
check_dependencies() {
  command -v jq >/dev/null 2>&1 || { echo "Error: jq is required but not installed"; exit 1; }
  command -v zip >/dev/null 2>&1 || { echo "Error: zip is required but not installed"; exit 1; }
  command -v npm >/dev/null 2>&1 || { echo "Error: npm is required but not installed"; exit 1; }
  command -v tsc >/dev/null 2>&1 || { echo "Error: TypeScript compiler (tsc) is required but not installed"; exit 1; }
}

# Execute dependency check
check_dependencies

# Check if manifest file exists
if [ ! -f "$MANIFEST_FILE" ]; then
  echo "Error: $MANIFEST_FILE not found in current directory!"
  exit 1
fi

# Extract the version from manifest.json
VERSION=$(jq -r '.version' "$MANIFEST_FILE")
if [ -z "$VERSION" ] || [ "$VERSION" = "null" ]; then
  echo "Error: Failed to extract version from $MANIFEST_FILE"
  exit 1
fi

# Setup output paths
ZIP_FILE_NAME="v${VERSION}.zip"
OUTPUT_ZIP="${OUTPUT_DIR}/${ZIP_FILE_NAME}"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Install dependencies and compile TypeScript
echo "Installing dependencies..."
npm install

echo "Compiling TypeScript..."
npm run compile

# Create the zip package
echo "Packaging version $VERSION..."
git ls-files -z | xargs -0 zip -r "$OUTPUT_ZIP"

# Verify zip was created
if [ -f "$OUTPUT_ZIP" ]; then
  echo "✅ Successfully created: $OUTPUT_ZIP"
  echo "Package excludes files in .gitignore"
else
  echo "Error: Failed to create zip package"
  exit 1
fi

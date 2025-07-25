#!/bin/zsh
#
# Script to package Chrome extension into a versioned zip file
# Requires: jq, zip, git

set -e  # Exit immediately if a command exits with non-zero status

# Constants
MANIFEST_FILE="manifest.json"
OUTPUT_DIR="output"
DIST_DIR="dist"

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

# Create directories if they don't exist
mkdir -p "$OUTPUT_DIR"

# Install dependencies and compile TypeScript
echo "Installing dependencies..."
npm install

echo "Compiling TypeScript..."
npm run compile

# Prepare dist directory with all extension files
echo "Preparing distribution files..."

# Copy all necessary files to dist (alongside the compiled JS files)
cp manifest.json "${DIST_DIR}/"
cp popup.html "${DIST_DIR}/"
cp style.css "${DIST_DIR}/"
cp -r images "${DIST_DIR}/"

# Create the zip package from dist
echo "Packaging version $VERSION..."
cd "${DIST_DIR}"
zip -r "../${OUTPUT_ZIP}" . -x "*.DS_Store" -x "extension/*"

# Return to original directory
cd ..

# Verify zip was created
if [ -f "$OUTPUT_ZIP" ]; then
  echo "✅ Successfully created: $OUTPUT_ZIP"
  echo "📁 Extension files available in: ${DIST_DIR}/"
  echo "   The dist directory contains the exact same files as the zip package"
else
  echo "Error: Failed to create zip package"
  exit 1
fi

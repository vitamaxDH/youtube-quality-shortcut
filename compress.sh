#!/bin/zsh

# Check if a manifest.json file exists
if [ ! -f "manifest.json" ]; then
  echo "manifest.json file not found!"
  exit 1
fi

# Extract the version from manifest.json using jq
VERSION=$(jq -r '.version' manifest.json)

# Check if the version was extracted successfully
if [ -z "$VERSION" ]; then
  echo "Version not found in manifest.json!"
  exit 1
fi

# Variables
ZIP_FILE_NAME="v${VERSION}.zip"
OUTPUT_DIR="output"
OUTPUT_ZIP="${OUTPUT_DIR}/${ZIP_FILE_NAME}"

# Create output directory if it doesn't exist
mkdir -p $OUTPUT_DIR

# Generate a list of files to include in the zip, respecting .gitignore
git ls-files -z | xargs -0 zip -r $OUTPUT_ZIP

echo "Created $OUTPUT_ZIP without files in .gitignore"

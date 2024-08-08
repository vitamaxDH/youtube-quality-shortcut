#!/bin/zsh

# Check if a file name is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <zip-file-name>"
  exit 1
fi

# Variables
ZIP_FILE_NAME=$1

# Append .zip extension if not present
if [[ $ZIP_FILE_NAME != *.zip ]]; then
  ZIP_FILE_NAME="${ZIP_FILE_NAME}.zip"
fi

OUTPUT_DIR="output"
OUTPUT_ZIP="${OUTPUT_DIR}/${ZIP_FILE_NAME}"

# Create output directory if it doesn't exist
mkdir -p $OUTPUT_DIR

# Generate a list of files to include in the zip, respecting .gitignore
git ls-files -z | xargs -0 zip -r $OUTPUT_ZIP

echo "Created $OUTPUT_ZIP without files in .gitignore"

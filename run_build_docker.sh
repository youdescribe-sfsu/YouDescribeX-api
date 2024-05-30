#!/bin/sh

# This script takes two arguments, GOOGLE_CRED_FILE and GOOGLE_APPLICATION_CREDENTIALS,
# and performs some operations using them.

# Check if both arguments are provided
if [ $# -ne 2 ]; then
  echo "Usage: $0 <GOOGLE_CRED_FILE> <GOOGLE_APPLICATION_CREDENTIALS>"
  exit 1
fi

# Assign the arguments to variables for clarity
GOOGLE_CRED_FILE="$1"
GOOGLE_APPLICATION_CREDENTIALS="$2"

# You can use the variables as needed in your script logic
# For example, decoding the base64 encoded string and appending it to the credentials file:
echo "$GOOGLE_CRED_FILE" | base64 -d -i - >> "$GOOGLE_APPLICATION_CREDENTIALS"

# Print a message indicating that the decoding and appending are done
echo "Credentials have been decoded and appended to $GOOGLE_APPLICATION_CREDENTIALS."

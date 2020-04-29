#!/bin/bash
set -euo pipefail

if [ -e .env ]
then
    # Export newline-delimited vars from .env file
    while IFS='=' read -r -a keyvalue_pair
    do
        declare -x ${keyvalue_pair[0]}=${keyvalue_pair[1]}
    done < .env
else
    echo ".env file does not exist"
fi
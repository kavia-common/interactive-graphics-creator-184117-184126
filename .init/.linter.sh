#!/bin/bash
cd /home/kavia/workspace/code-generation/interactive-graphics-creator-184117-184126/graphics_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi


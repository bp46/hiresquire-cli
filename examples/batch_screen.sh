#!/bin/bash

# HireSquire CLI Batch Screening Example
# This script screens resumes for multiple roles in parallel.

echo "🚀 Starting HireSquire Batch Screening..."

# Role 1: Frontend Engineer
hiresquire screen \
  --title "Frontend Engineer" \
  --description "React, TypeScript, TailwindCSS expertise required." \
  --resumes ./resumes/frontend/ \
  --leniency 6 \
  --json > frontend_job.json &

# Role 2: Backend Engineer
hiresquire screen \
  --title "Backend Engineer" \
  --description "Python, Django, PostgreSQL, and AWS experience." \
  --resumes ./resumes/backend/ \
  --leniency 8 \
  --json > backend_job.json &

# Wait for all background jobs to finish
wait

echo "✅ All screening jobs submitted!"

# Parse job IDs and check status
FRONTEND_ID=$(jq -r '.job_id' frontend_job.json)
BACKEND_ID=$(jq -r '.job_id' backend_job.json)

echo "Frontend Job ID: $FRONTEND_ID"
echo "Backend Job ID: $BACKEND_ID"

echo "Waiting for results..."
hiresquire status --job $FRONTEND_ID --watch
hiresquire status --job $BACKEND_ID --watch

echo "🎉 Done! Check your results with 'hiresquire results --job <id>'"

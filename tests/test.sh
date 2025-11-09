#!/bin/bash

# test.sh - Validation script for QueueCTL core flows
# Usage: ./test.sh OR npm test
# Assumptions: Run in project root; queuectl is available via npm link or npx
# Cleans up files at start/end

set -e  # Exit on error

# Helper to check if string contains substring
contains() {
  grep -q "$1" "$2"
}

echo "🧹 Cleaning up files..."
rm -f jobs.json config.json .worker_pids.json

echo "✅ Starting tests..."

# Test 1: Config Management
echo "Testing config..."
queuectl config get > config.out
if ! contains "max_retries" config.out || ! contains "3" config.out; then
  echo "❌ Config get failed"
  exit 1
fi

queuectl config set max_retries 4
queuectl config get > config.out
if ! contains "4" config.out; then
  echo "❌ Config set failed"
  exit 1
fi
queuectl config set max_retries 3  # Reset

# Test 2: Enqueue Jobs
echo "Testing enqueue..."
queuectl enqueue '{"id":"test_success","command":"echo Success"}'
queuectl enqueue '{"id":"test_fail","command":"exit 1","max_retries":2}'
if [ ! -f jobs.json ]; then
  echo "❌ No jobs.json"
  exit 1
fi

# Test 3: List Jobs
echo "Testing list..."
queuectl list > list.out
if ! contains "test_success" list.out || ! contains "pending" list.out; then
  echo "❌ List failed"
  exit 1
fi

# Test 4: Workers & Processing
echo "Testing workers..."
queuectl worker start --count 1 &
WORKER_PID=$!
sleep 5  # Allow processing

queuectl list --state completed > completed.out
if ! contains "test_success" completed.out; then
  echo "❌ Success job not completed"
  kill $WORKER_PID
  exit 1
fi

# Test 5: Retries & DLQ
sleep 15  # Wait for retries (backoff delays)
queuectl dlq list > dlq.out
if ! contains "test_fail" dlq.out || ! contains "dead" dlq.out; then
  echo "❌ Fail job not in DLQ"
  kill $WORKER_PID
  exit 1
fi

# Test 6: DLQ Retry
echo "Testing DLQ retry..."
queuectl dlq retry test_fail
queuectl list --state pending > pending.out
if ! contains "test_fail" pending.out; then
  echo "❌ Retry failed"
  kill $WORKER_PID
  exit 1
fi

queuectl worker stop

# Cleanup
rm -f *.out
echo "✅ All tests passed!"
echo "🧹 Final cleanup..."
rm -f jobs.json config.json .worker_pids.json
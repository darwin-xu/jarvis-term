#!/bin/bash

# Test execution script for development workflow
# This script helps ensure code quality before commits

set -e  # Exit on any error

echo "🚀 Starting Jarvis Terminal Test Suite"
echo "======================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "📦 Installing dependencies..."
npm ci

echo ""
echo "🔍 Checking TypeScript compilation..."
echo "--------------------------------------"
npm run build:server
npm run build:client
echo "✅ TypeScript compilation successful"

echo ""
echo "🎨 Checking code formatting..."
echo "-------------------------------"
if npm run format:check; then
    echo "✅ Code formatting is correct"
else
    echo "❌ Code formatting issues found. Run 'npm run format' to fix."
    exit 1
fi

echo ""
echo "🧪 Running test suite..."
echo "-------------------------"

# Run tests with coverage
if npm run test:coverage; then
    echo "✅ All tests passed!"
else
    echo "❌ Some tests failed. Please fix them before proceeding."
    exit 1
fi

echo ""
echo "📊 Test Coverage Summary:"
echo "-------------------------"
# Display coverage summary (jest outputs this automatically)

echo ""
echo "🔒 Running security audit..."
echo "-----------------------------"
if npm audit --audit-level=moderate; then
    echo "✅ No security vulnerabilities found"
else
    echo "⚠️  Security vulnerabilities detected. Please review and fix."
fi

echo ""
echo "🎉 All checks completed successfully!"
echo "====================================="
echo ""
echo "💡 Tips:"
echo "   • Run 'npm run test:watch' for development"
echo "   • Run 'npm run format' to auto-fix formatting"
echo "   • Check TESTING.md for detailed testing documentation"
echo ""

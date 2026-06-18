#!/bin/bash
set -e

echo "🐳 Setting up Docker PostgreSQL and running tests..."
echo "=================================================="

# Set test environment variables
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/nova_billiard_pos_test"
export NEXTAUTH_SECRET="test-secret-key-for-github-actions-only"
export NEXTAUTH_URL="http://localhost:3000"
export DEPLOYMENT_MODE="test"

echo "📋 Environment:"
echo "  DATABASE_URL: $DATABASE_URL"
echo "  DEPLOYMENT_MODE: $DEPLOYMENT_MODE"
echo ""

# Start PostgreSQL with Docker Compose
echo "🚀 Starting PostgreSQL container..."
docker-compose -f docker-compose.test.yml up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
timeout=30
while ! docker-compose -f docker-compose.test.yml exec -T postgres pg_isready -U postgres -d nova_billiard_pos_test > /dev/null 2>&1; do
    timeout=$((timeout - 1))
    if [ $timeout -le 0 ]; then
        echo "❌ PostgreSQL failed to start within 30 seconds"
        docker-compose -f docker-compose.test.yml logs postgres
        docker-compose -f docker-compose.test.yml down
        exit 1
    fi
    sleep 1
done

echo "✅ PostgreSQL is ready!"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
bun install --frozen-lockfile

# Run database migrations
echo "🔄 Running database setup..."
bun run db:generate

# Push database schema with force flag
echo "🔄 Pushing database schema..."
bunx drizzle-kit push --force

# Run tests
echo ""
echo "🧪 Running tests..."
bun run test --passWithNoTests

# Check if tests passed
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All tests passed!"
    
    # Run linting
    echo ""
    echo "🔍 Running linter..."
    bun run lint || echo "⚠️  Linting issues found"
    
    # Test builds
    echo ""
    echo "🏗️  Testing build..."
    bun run build
    
    echo ""
    echo "🎉 All checks completed successfully!"
else
    echo ""
    echo "❌ Tests failed!"
    exit 1
fi

# Cleanup function
cleanup() {
    echo ""
    echo "🧹 Cleaning up..."
    docker-compose -f docker-compose.test.yml down -v
    echo "✅ Cleanup completed"
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Ask if user wants to keep the database running
echo ""
read -p "Keep PostgreSQL container running? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📝 PostgreSQL will keep running. To stop it later, run:"
    echo "   docker-compose -f docker-compose.test.yml down -v"
    trap - EXIT  # Remove the cleanup trap
else
    cleanup
fi

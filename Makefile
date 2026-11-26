.PHONY: install dev build preview lint format typecheck test coverage e2e check docker-build docker-run

IMAGE ?= projeto-cisco-redes

install:
	npm ci

dev:
	npm run dev

build:
	npm run build

preview: build
	npm run preview

lint:
	npm run lint

format:
	npm run format

typecheck:
	npm run typecheck

test:
	npm test

coverage:
	npm run test:coverage

e2e:
	npm run test:e2e

check:
	npm run check

docker-build:
	docker build -t $(IMAGE) .

docker-run: docker-build
	docker run --rm -p 8080:8080 $(IMAGE)

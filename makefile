.PHONY: help run server build test

.ONESHELL:

## make help: show this message.
help:
	grep -h -E '^##' ${MAKEFILE_LIST} | sed -e 's/## //g' | column -t -s ':'

## make run: build all workspaces then start server on :8038, log to stdout (foreground).
run: apps/server/dist/index.js packages/db/dist/index.js
	export NVM_DIR="$$HOME/.nvm"
	[ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh"
	DIBAO_HOST=0.0.0.0
	DIBAO_PORT=8038
	DIBAO_DATABASE_PATH=$(PWD)/../database/dibao.sqlite
	DIBAO_COOKIE_SECURE=false
	export DIBAO_HOST DIBAO_PORT DIBAO_DATABASE_PATH DIBAO_COOKIE_SECURE
	PIDS=$$(lsof -ti tcp:$$DIBAO_PORT)
	if [ -n "$$PIDS" ]; then \
		echo "Killing process(es) on port $$DIBAO_PORT: $$PIDS"; \
		kill -9 $$PIDS; \
	fi
	node apps/server/dist/index.js

## make server: start server on :8038, log to file (background).
server:
	export NVM_DIR="$$HOME/.nvm"
	[ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh"
	DIBAO_HOST=0.0.0.0
	DIBAO_PORT=8038
	DIBAO_DATABASE_PATH=$(PWD)/data/dibao.sqlite
	DIBAO_COOKIE_SECURE=false
	export DIBAO_HOST DIBAO_PORT DIBAO_DATABASE_PATH DIBAO_COOKIE_SECURE
	PIDS=$$(lsof -ti tcp:$(DIBAO_PORT))
	if [ -n "$$PIDS" ]; then
		echo "Killing process(es) on port $(DIBAO_PORT): $$PIDS"
		kill -9 $$PIDS
	fi
	nohup node apps/server/dist/index.js >> server.log 2>&1 &
	echo "Server started on :8038, logs → server.log"

## make test: run all workspace tests.
test:
	export NVM_DIR="$$HOME/.nvm"
	[ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh"
	npm test

## make build: build all workspaces.
build: apps/server/dist/index.js packages/db/dist/index.js

## rebuild server dist when missing (or outdated).
apps/server/dist/index.js: packages/db/dist/index.js

packages/db/dist/index.js: node_modules/.package-lock.json
	export NVM_DIR="$$HOME/.nvm"
	[ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh"
	npm run build

## auto `npm ci` when package-lock.json changes.
node_modules/.package-lock.json: package-lock.json
	export NVM_DIR="$$HOME/.nvm"
	[ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh"
	npm ci

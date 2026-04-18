.PHONY: all
.PHONY: clean
.PHONY: lint
.PHONY: test

all: lint
clean:
test:

lint:
	pre-commit run --config cfg/pre-commit-lint.yml --all-files

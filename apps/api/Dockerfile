FROM php:8.5-cli-bookworm
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev unzip git \
    && docker-php-ext-install pdo_pgsql \
    && pecl install redis-6.3.0 \
    && docker-php-ext-enable redis \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
WORKDIR /app
CMD ["php", "-S", "0.0.0.0:8000", "-t", "public", "public/index.php"]

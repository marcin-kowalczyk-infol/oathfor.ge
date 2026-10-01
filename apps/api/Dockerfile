FROM php:8.5-cli-bookworm
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev libjpeg62-turbo-dev libpng-dev zlib1g-dev unzip git \
    && docker-php-ext-install pdo_pgsql \
    && docker-php-ext-configure gd --with-jpeg \
    && docker-php-ext-install gd \
    && pecl install redis-6.3.0 \
    && docker-php-ext-enable redis \
    && rm -rf /var/lib/apt/lists/*
# Proof uploads: ADR 0008 allows JPEG up to 10 MB, multipart overhead needs headroom.
# A displayed startup warning, such as a body over post_max_size, is printed before the headers and turns 413 JSON into 200 HTML. CLI warnings go to stderr.
RUN printf 'upload_max_filesize = 12M\npost_max_size = 13M\ndisplay_errors = stderr\ndisplay_startup_errors = Off\n' > /usr/local/etc/php/conf.d/proof-upload.ini
# Private proof volume mount point. A fresh named volume copies this mode.
RUN mkdir -p /var/lib/oathforge/proofs && chmod 0700 /var/lib/oathforge/proofs
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
WORKDIR /app
CMD ["php", "-S", "0.0.0.0:8000", "-t", "public", "public/index.php"]

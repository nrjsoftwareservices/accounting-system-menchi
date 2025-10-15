FROM php:8.3-fpm-alpine

RUN apk add --no-cache bash zip unzip git icu-dev oniguruma-dev libzip-dev $PHPIZE_DEPS \
    && docker-php-ext-install pdo pdo_mysql intl mbstring zip \
    && pecl install redis \
    && docker-php-ext-enable redis

WORKDIR /var/www/html

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

CMD ["php-fpm"]


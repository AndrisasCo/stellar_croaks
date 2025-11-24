# Используем официальный образ Node.js 18 как базовый
FROM mirror.gcr.io/library/node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем файлы package*.json первыми для лучшего кэширования
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем остальные файлы проекта
COPY . .

# Собираем приложение
RUN npm run build

# Экспортируем порт, который будет использоваться для сервера preview
EXPOSE 4173

# Запускаем приложение в режиме preview
CMD ["npm", "run", "preview"]

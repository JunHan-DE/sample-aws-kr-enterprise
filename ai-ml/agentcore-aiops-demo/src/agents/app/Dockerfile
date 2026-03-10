FROM python:3.12-slim
WORKDIR /app
ENV AWS_DEFAULT_REGION=ap-northeast-2
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8080
CMD ["python", "agent.py"]

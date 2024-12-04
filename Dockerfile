FROM ubuntu:23.04

WORKDIR /app

# Update and install dependencies including Python, Gunicorn, Node.js, and npm
RUN apt-get update && \
    apt-get install -y curl g++ unixodbc-dev python3 python3-pip python3-venv gunicorn nodejs npm && \
    rm -rf /var/lib/apt/lists/*

# Install PM2 globally
RUN npm install pm2 -g

# Setup Microsoft repositories and install ODBC driver
RUN curl https://packages.microsoft.com/keys/microsoft.asc | tee /etc/apt/trusted.gpg.d/microsoft.asc && \
    curl https://packages.microsoft.com/config/ubuntu/23.04/prod.list | tee /etc/apt/sources.list.d/mssql-release.list && \
    apt-get update && \
    ACCEPT_EULA=Y apt-get install -y msodbcsql18 && \
    rm -rf /var/lib/apt/lists/*

# Create a virtual environment
RUN python3 -m venv venv

ENV PATH="/app/venv/bin:$PATH"

# Install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install -r requirements.txt

# Copy the ecosystem config and the rest of the application
COPY ecosystem.config.js /app/ecosystem.config.js
COPY . /app/

# Define command to run the app using PM2
CMD ["pm2-runtime", "ecosystem.config.js"]

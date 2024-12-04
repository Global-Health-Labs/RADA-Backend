# RoboNAAT-WG-Taller-BE
Back-End RoboNAAT Code

## TypeScript/Express.js Version (Current)

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (for development)
- MSSQL (for production)

### Setup and Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.typescript.example .env
# Edit .env with your configuration
```

3. Generate database migrations:
```bash
npm run generate
```

4. Run migrations:
```bash
npm run migrate
```

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Database Studio
To view and manage your database:
```bash
npm run studio
```

## Python/Flask Version (Archived)

The original Python/Flask version has been archived in the `/archive` directory. For reference, here are the original setup instructions:

### to start the mysql container
```bash
docker-compose up -d
```

### to stop the mysql container
```bash
docker-compose down
```

### to connect to DB from terminal
```bash
mysql -h 127.0.0.1 -P 3306 -u my-user -p
```

### create and activate a virtual environment in Windows

```bash
python -m venv venv
venv\Scripts\activate
```

### create and activate a virtual environment in macOs and Linux:
```bash
python3 -m venv venv
source venv/bin/activate
```
## On Mac - Install Unix ODBC
```bash
brew install unixodbc
```

### install dependencies
```bash
pip3 install -r requirements.txt
```

## On Mac - Install MS SQL Server driver
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release
brew update
HOMEBREW_ACCEPT_EULA=Y brew install msodbcsql17 mssql-tools17
```



### to start the flask app
```bash
python3 app.py
```

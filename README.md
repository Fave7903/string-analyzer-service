# String Analyzer Service

## Description

A RESTful API service for analyzing strings, fetching them, and filtering by natural language queries. Built as part of HNG Stage 1 Task.

---

## Features

* Analyze a string and extract properties (palindrome, length, word count, characters, etc.)
* Retrieve all strings
* Retrieve a specific string by value
* Delete a string by value
* Filter strings using natural language queries

---

## Setup Instructions

1. **Clone the repository:**

```bash
git clone https://github.com/Fave7903/string-analyzer-service.git
cd string-analyzer-service
```

2. **Install dependencies:**

```bash
npm install
```

3. **Environment Variables:**
   Create a `.env` file in the root directory with the following variables:

```
MONGO_URI=<your_mongodb_connection_string>
PORT=3000
```

Replace `<your_mongodb_connection_string>` with your MongoDB Atlas URI or local MongoDB URI.

4. **Start the server:**

* Development mode (with auto-reload using nodemon):

```bash
npm run dev
```

* Production mode:

```bash
npm start
```

Server will run on `http://localhost:3000` by default.

---

## API Endpoints

### 1. Analyze a String

* **POST** `/strings`
* **Body:**

```json
{
  "value": "example string"
}
```

* **Description:** Analyzes the string and stores it in the database.

### 2. Get All Strings

* **GET** `/strings`
* **Description:** Retrieves all stored strings.

### 3. Get String by Value

* **GET** `/strings/:string_value`
* **Description:** Retrieves a specific string by its value.

### 4. Delete String

* **DELETE** `/strings/:string_value`
* **Description:** Deletes a specific string by its value.

### 5. Filter by Natural Language

* **GET** `/strings/filter-by-natural-language?query=<query_string>`
* **Description:** Filters strings based on natural language queries, e.g.,

  * "all single word palindromic strings"
  * "palindromic strings that contain the first vowel"
* **Example:**

```
GET /strings/filter-by-natural-language?query=all single word palindromic strings
```

---

## Dependencies

* express: ^5.1.0
* mongoose: ^8.19.1
* cors: ^2.8.5
* dotenv: ^17.2.3
* nodemon: ^3.1.10 (dev)

Install dependencies using `npm install`.

---

## License

ISC

---

## Repository

[GitHub Repository](https://github.com/Fave7903/string-analyzer-service)


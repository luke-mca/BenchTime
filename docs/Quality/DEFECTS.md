## Purpose 
The purpose of this document is to keep track of any defects found in BenchTimes software/architecture and how they were fixed. 

## Information

| Defect ID | Name | Description | Solution |
|-----------|------|-------------|----------|
|     1      |  Rate Limiting    |      No rate limiting existed for BenchTime. This means endpoints have no protection which could have been absued to DDos our server.       |     We use the rate limiting provided by express to fix this. See server/src/app.js for details and server/__tests__/rateLimit.test.js for information on testing the rate limiting.     |
|           |      |             |          |
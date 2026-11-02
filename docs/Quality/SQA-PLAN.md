# BenchTime SQA Plan

## Standards

- All code changes are maintained on their own branch before a pull request is open(see definition of done in the README)
- Architecture is aligned with the architecture diagrams in the Architecture folder. 
- ADR is resepected see ADR folder. 

## Reviews

- Every change MUST be reviewed by the Author AND by one other person before anything is merged into main. 
- All code is reviewed again before each milestone release. 

## Testing

- Unit tests: Use a mock repository layer to test middleware, routes, services, and utils for the server and components for the client. Under the client and server directories. 
- Integration tests: Use a test database to test basic user flows. Under the server directory. 
- Component tests: Test react components under the client directory. 
- End-to-end tests: Viewport/browser testing with a test database. Under the client directory. 
- Security: Rate limit tests performed to ensure rate limits are respected. Under the client directory. 
- Performance testing: Reserved for milestone 3 when the server is deployed. 

## Defect Tracking

- All discovered defects are tracked in the DEFECTS.md file in the same directory. 

## Metrics Tracked

- Defects per merge(right now 1 out of 14 approved pull requests).
- Code coverage. See the repo README for details on generating coverage metrics. 

## Ownership

- Owned by Jesse and Luke. 
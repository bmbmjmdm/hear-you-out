# on testing fastapi with pytest: https://www.jeffastor.com/blog/testing-fastapi-endpoints-with-docker-and-pytest/

# notes on pytest https://docs.pytest.org/en/6.2.x/fixture.html
# - to run multiple asserts safely,: All that’s needed is stepping up to a larger scope, then having the act step defined as an autouse fixture, and finally, making sure all the fixtures are targetting that highler level scope. 
# - use markers to pass data to fixtures
# - - example given is for scalar data. what about dict?
# - “factory as fixture” pattern can help in situations where the result of a fixture is needed multiple times in a single test, parameterizable in test
# - parameterize fixtures to run all tests depending on them per parameter, for when components themselves can be configured multiple ways
# - can use markers to run fixtures for all tests in a class/module when you don't need it's return value (eg @pytest.mark.usefixtures("cleandir"))
# - can override fixtures, useful in big projects
# - can run a series of tests incrementally if latter don't make sense to run when former fails: https://docs.pytest.org/en/6.2.x/example/simple.html#incremental-testing-test-steps
# - best practices for organization, packaging: https://docs.pytest.org/en/6.2.x/goodpractices.html 

# notes on pytest usage https://docs.pytest.org/en/6.2.x/usage.html
# - specifying tests via module, directory ,keyword, note id, pytest.marker, pkg
# - modifying traceback printing
# - dropping to python debugger pdb
# - profiling

# notes on pytest parameterization https://docs.pytest.org/en/6.2.x/parametrize.html and https://docs.pytest.org/en/6.2.x/example/parametrize.html#paramexamples
# - pytest.fixture() allows one to parametrize fixture functions (as discussed above)
# - @pytest.mark.parametrize allows one to define multiple sets of arguments and fixtures at the test function or class
# - - can dynamically generate them
# - - can stack them on top of each other to get all combinations
# - pytest_generate_tests allows one to define custom parametrization schemes or extensions
# - stackOverflow Q on passing args to a fixture: https://stackoverflow.com/questions/44677426/can-i-pass-arguments-to-pytest-fixtures
# - - explains indirect parameterization a bit more

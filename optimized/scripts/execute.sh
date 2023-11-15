#!/bin/bash
# config
PROFILE=playground
STACK_NAME=PowerTuningStack
INPUT=$(cat scripts/params.json)  # or use a static string
STATE_MACHINE_ARN=arn:aws:states:region:account:stateMachine:powerTuningStateMachine-xxxxxx

# start execution
EXECUTION_ARN=$(aws stepfunctions start-execution --state-machine-arn $STATE_MACHINE_ARN --input "$INPUT"  --query 'executionArn' --profile $PROFILE --output text)

echo -n "Execution started..."

# poll execution status until completed
while true;
do
    # retrieve execution status
    STATUS=$(aws stepfunctions describe-execution --execution-arn $EXECUTION_ARN --query 'status' --profile $PROFILE --output text)

    if test "$STATUS" == "RUNNING"; then
        # keep looping and wait if still running
        echo -n "."
        sleep 1
    elif test "$STATUS" == "FAILED"; then
        # exit if failed
        echo -e "\nThe execution failed, you can check the execution logs with the following script:\naws stepfunctions get-execution-history --execution-arn $EXECUTION_ARN"
        break
    else
        # print execution output if succeeded
        echo $STATUS
        echo "Execution output: "
        # retrieve output
        aws stepfunctions describe-execution --execution-arn $EXECUTION_ARN --query 'output' --profile $PROFILE --output text
        break
    fi
done
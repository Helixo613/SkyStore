pipeline {
    agent any

    environment {
        IMAGE_NAME = 'cloudlet' // Local Docker image name
        IMAGE_TAG = 'latest'
        CONTAINER_NAME = 'cloudlet-container' // Name of the running container
        VITE_CONVEX_URL = credentials('VITE_CONVEX_URL') // Retrieve the secret from Jenkins
    }

    stages {
        stage('Checkout Code') {
            steps {
                // Clone the repository
                checkout scm
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    // Build the Docker image and pass the secret as a build argument
                    sh '''
                    docker build --no-cache \
                        --build-arg VITE_CONVEX_URL=${VITE_CONVEX_URL} \
                        -t ${IMAGE_NAME}:${IMAGE_TAG} .
                    '''
                }
            }
        }
        stage('Smoke Test') {
            steps {
                script {
                    sh '''
                    docker run --name temp-${CONTAINER_NAME} -d -p 8081:80 ${IMAGE_NAME}:${IMAGE_TAG}
                    sleep 5 # Wait for the container to start
                    '''

                    sh '''
                    curl -s http://localhost:8081 | grep -q "<title>Cloudlet</title>" || (docker logs temp-${CONTAINER_NAME} && docker stop temp-${CONTAINER_NAME} && docker rm temp-${CONTAINER_NAME} && exit 1)
                    '''

                    // Stop and remove the temporary container after the test
                    sh '''
                    docker stop temp-${CONTAINER_NAME}
                    docker rm temp-${CONTAINER_NAME}
                    '''
                }
            }
        }
        stage('Stop Existing Container') {
            steps {
                script {
                    // Stop and remove any existing container (running or stopped)
                    sh '''
                    if [ $(docker ps -a -q -f name=${CONTAINER_NAME}) ]; then
                        echo "Removing existing container: ${CONTAINER_NAME}"
                        docker rm -f ${CONTAINER_NAME}
                    else
                        echo "No existing container found with name ${CONTAINER_NAME}"
                    fi
                    '''
                }
            }
        }


        stage('Run New Container') {
            steps {
                script {
                    // Run the new container and pass the secret as a runtime environment variable
                    sh '''
                    docker run -d --name ${CONTAINER_NAME} -p 80:80 ${IMAGE_NAME}:${IMAGE_TAG}
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'Application successfully built, tested, and hosted!'
        }
        failure {
            echo 'Pipeline failed!'
        }
    }
}
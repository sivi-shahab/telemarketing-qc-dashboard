// GANTI SEBELUM DIPAKAI: REGISTRY (+ credentialsId 'gitlab-registry' di Jenkins)
// dan VITE_API_URL sesuai environment tujuan — nilainya harus prefix yang di
// nginx depan diproxy ke App B :4000 (di call-qc: /api-b).
//
// Catatan: VITE_API_URL di-*bake* saat build (Vite mengganti nilainya di bundle),
// jadi satu image terikat ke satu environment.
pipeline {
  agent any

  environment {
    IMAGE        = "qc-dashboard"
    REGISTRY     = "registry.gitlab.<domain>/<group>"
    TAG          = "${env.GIT_COMMIT.take(8)}"
    VITE_API_URL = "/api-b"
  }

  stages {
    stage('Checkout') { steps { checkout scm } }

    stage('Install') { steps { sh 'npm ci' } }

    stage('Test') { steps { sh 'npm test' } }

    stage('Build') {
      steps {
        sh "docker build --build-arg VITE_API_URL=${VITE_API_URL} -t ${REGISTRY}/${IMAGE}:${TAG} -t ${REGISTRY}/${IMAGE}:latest ."
      }
    }

    stage('Push') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'gitlab-registry',
                                          usernameVariable: 'U', passwordVariable: 'P')]) {
          sh '''
            echo "$P" | docker login ${REGISTRY} -u "$U" --password-stdin
            docker push ${REGISTRY}/${IMAGE}:${TAG}
            docker push ${REGISTRY}/${IMAGE}:latest
          '''
        }
      }
    }

    stage('Deploy') {
      when { branch 'main' }
      steps { sh 'docker compose up -d --no-deps dashboard' }
    }
  }
}

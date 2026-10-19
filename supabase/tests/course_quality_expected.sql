-- Expected editorial results, plus preservation of existing learning evidence.

SELECT public.test_assert((SELECT description='A notebook for practising machine-learning algorithms. Run the examples, identify each learning task and compare assumptions and evaluation metrics with the lecture material.' FROM public.capsules WHERE id='dde43f20-164c-47be-a89e-3e131104d6b1'),'lesson description improved');
SELECT public.test_assert((SELECT description='Explore how combining estimators can improve predictive performance, and compare the added complexity and evaluation results with a single-model baseline.' FROM public.capsules WHERE id='b4e0a008-5ee5-43c8-92d8-db45860a021c'),'lesson description improved');
SELECT public.test_assert((SELECT description='Use logistic regression as a classification baseline, then compare its assumptions and held-out performance with more complex models.' FROM public.capsules WHERE id='3ecebff9-89fb-4799-a437-69b87d4b66a5'),'lesson description improved');
SELECT public.test_assert((SELECT description='Train a PPO actor-critic policy in MetaDrive. Examine how the reward, observations, action space and simulator rules shape behavior, then evaluate held-out scenarios.' FROM public.capsules WHERE id='4523f54c-06f8-48d5-a2b0-e9a67966dffc'),'lesson description improved');
SELECT public.test_assert((SELECT description='Train and evaluate a traffic-sign classifier using GTSRB. Inspect per-class errors and keep evaluation data separate from model and threshold selection.' FROM public.capsules WHERE id='56dd7a30-3797-4d6a-abf9-8114dc9fc1ed'),'lesson description improved');
SELECT public.test_assert((SELECT description='Study a machine-learning-based emergency-braking project in MetaDrive, with attention to missed hazards, unnecessary interventions and the limits of simulator evidence.' FROM public.capsules WHERE id='6952ae8a-ebaa-45b0-97ab-4a1b1b8e5aed'),'lesson description improved');
SELECT public.test_assert((SELECT content_value='# Welcome

This course connects programming, machine learning and simulation-based autonomous-driving projects. Its seven technical modules cover programming; ML foundations; supervised learning and a simulated AEB project; prediction and planning; deep learning and reinforcement learning; computer vision; and multimodal/generative AI.

The catalogue includes lectures, notebooks, project repositories and reference material. Work through the module introductions, run the relevant artifacts and record what you can reproduce in your environment. The accompanying study guide provides a shared evaluation task and submission rubric.

The projects are learning exercises. A successful notebook, classifier or simulator policy does not establish readiness for road use. Learned policies also depend on designed rewards, observations and environment rules; they are not rule-free systems.

Start with programming foundations if you need Python, data structures or data-analysis practice. Otherwise, check those skills and continue to the ML foundations. Keep a record of dependencies, data splits, baselines and failures as you progress.' FROM public.capsule_content WHERE id='7f42d378-1796-4d9b-bd58-e4b9bc2650e0'),'text correction applied');
SELECT public.test_assert((SELECT content_value='## Deep learning and reinforcement learning

The lecture introduces neural networks and policies learned through interaction. The linked PyTorch and GTSRB notebooks provide practice with models and image classification; the MetaDrive PPO project introduces an actor-critic driving policy.

Deep learning can learn useful representations, but it does not remove the need for data checks, suitable targets or careful evaluation. Reinforcement learning depends on the specified observations, actions, rewards and environment dynamics. Review these definitions in the [RL concepts reference](https://spinningup.openai.com/en/latest/spinningup/rl_intro.html).

Compare a learned policy with a declared baseline on the same held-out simulator scenarios. Measure failures and execution requirements as well as reward. Neither learned nor hand-designed control is automatically safer or better for every task.

Next, examine the computer-vision resources and the assumptions introduced when inputs come from images.' FROM public.capsule_content WHERE id='ca30d049-f6a3-4e05-9cca-1602ed70b232'),'text correction applied');
SELECT public.test_assert((SELECT content_value='# Review your evidence

The course provides projects involving simulated AEB, traffic-sign classification, reinforcement learning, perception and multimodal or generative AI. Before describing a project as complete, check that you can reproduce its run, explain its inputs and outputs, and show evaluation on data or scenarios held out from development.

For each completed project, keep a README with versions, data permissions, a baseline, metrics and a failure analysis. Clearly distinguish implemented results from planned extensions. Publish only material you have permission to share.

The ADAS course extends the learning sequence into requirements, architecture, controls and a simulated capstone workflow. The Vehicle Dynamics and Control course provides additional study of PID, LQR and MPC. These methods have different assumptions and validation needs; no method is universally best or automatically safe.

Use the study-guide rubric to choose your next improvement: clearer experiment design, stronger tests, better reproducibility or a more precise account of the limits.' FROM public.capsule_content WHERE id='b1bac4a5-b42a-4e0d-be33-59534b734929'),'text correction applied');
SELECT public.test_assert((SELECT question_text='Compared with per-frame object detection, multi-object tracking typically adds:' AND correct_answer='"b"'::jsonb AND explanation='Tracking links observations over time and can estimate motion for persistent tracks. Object identity is not a prerequisite for every velocity measurement: Doppler radar can estimate radial velocity. See https://www.mathworks.com/help/radar/ug/doppler-estimation.html.' FROM public.quiz_questions WHERE id='00941394-9e1e-40cc-82e2-e34d63a744fb'),'factual quiz correction applied');
SELECT public.test_assert((SELECT question_text='Which result could justify choosing a classical model over a deep network for a particular ADAS subtask?' AND correct_answer='"b"'::jsonb AND explanation='Select a model using evidence for the specific task and implementation constraints. Neither classical nor deep models are universally superior, and model choice alone does not certify a feature. Compare measured latency and predictive performance; see https://scikit-learn.org/stable/computing/computational_performance.html.' FROM public.quiz_questions WHERE id='03fb8f77-7cc3-4893-b0b3-e1dcddbf8c1e'),'factual quiz correction applied');
SELECT public.test_assert((SELECT question_text='Bug-free model code guarantees reliable predictions in a new driving environment.' AND correct_answer='"false"'::jsonb AND explanation='A system can fail because the evaluation protocol leaked information, preprocessing differs at inference, or the new data differs from the development distribution. Correct code alone does not establish generalization. See https://scikit-learn.org/stable/common_pitfalls.html.' FROM public.quiz_questions WHERE id='05b4dd39-bbdd-4b4b-8808-83456da18b99'),'factual quiz correction applied');
SELECT public.test_assert((SELECT description='Explore a PPO driving policy in MetaDrive. Compare its reward, observations and held-out scenario performance with a declared baseline; simulator success does not establish road readiness.' FROM public.capsules WHERE id='03e180d1-7eed-443b-b871-3e5b3caa7594'),'lesson description improved');
SELECT public.test_assert((SELECT description='Study model-level testing, generated-code execution in SIL and code generation. Compare outputs under stated tolerances and distinguish host-based tests from evidence on target hardware.' FROM public.capsules WHERE id='41c43401-5bd9-443e-ad19-b764a7223ed0'),'lesson description improved');
SELECT public.test_assert((SELECT content_value='# Welcome

This course introduces an ADAS development workflow through programming, machine learning, prediction/planning, C++, vehicle dynamics, functional-safety concepts and a simulation-based capstone.

The listed projects include ML-based AEB, image classification, PPO in MetaDrive, planning, ACC in C++ and a final AEB/ACC/LKA workflow using Simulink and IPG CarMaker. Treat these as opportunities to build and evaluate engineering examples; completing them does not establish a production safety case or deployment approval.

Start with the SDV lab material and confirm access to the software required for your chosen projects. The final co-simulation and code-generation exercises depend on the relevant licensed products and compatible versions. Keep your tool versions and assumptions with your work.

Use the capstone brief on this page to connect requirements, interfaces, controller behavior and test evidence. Review each module introduction before the lecture and project resources. If you already know a foundation topic, demonstrate the prerequisite skill before moving ahead.' FROM public.capsule_content WHERE id='cb70d306-eaaf-4a8f-a5e8-3fc292b4efea'),'text correction applied');
SELECT public.test_assert((SELECT content_value='## Systems engineering and functional-safety concepts

These introductory resources cover hazard analysis, ASIL concepts, the V-model and implementation activities associated with functional safety. Use them to connect a feature''s intended behavior to its hazards, requirements and verification evidence.

A high score on an ML test set is only one kind of evidence. It does not establish that interfaces, fault handling, operating assumptions or the complete feature are adequate. Likewise, a short course overview is not a complete interpretation of ISO 26262 or a certification assessment.

Before the capstone, identify the boundaries of your simulated system, record assumptions and write requirements that a test can evaluate. The next module provides the requirements exercise and a model-based workflow in which to practise those skills.' FROM public.capsule_content WHERE id='6a1e6768-7065-4463-9e19-f794670e0d5c'),'text correction applied');
SELECT public.test_assert((SELECT content_value='## Capstone: requirements, implementation and test evidence

Use the requirements-writing assignment before reading its worked solution. Then study the AEB, ACC and LKA project resources, the IPG CarMaker co-simulation example and the material on MIL/SIL testing and code generation.

Keep a trace from each requirement to its model or code component, test inputs, expected output and recorded result. State the tool versions, licenses and plant assumptions needed to reproduce the work.

Model-level testing evaluates the selected model; SIL additionally executes generated code on the development computer and supports numerical comparison. Neither activity alone establishes correctness on target hardware or safety in the full operating environment. The [MathWorks SIL/PIL overview](https://www.mathworks.com/help/ecoder/ug/about-sil-and-pil-simulations.html) explains the execution distinction.

Complete the accompanying capstone evidence pack and report both passing tests and known limitations.' FROM public.capsule_content WHERE id='52932f29-a468-49e4-a146-04de18886745'),'text correction applied');
SELECT public.test_assert((SELECT question_text='Which result could justify choosing a classical model over a deep network for a particular ADAS subtask?' AND correct_answer='"b"'::jsonb AND explanation='Select a model using evidence for the specific task and implementation constraints. Neither classical nor deep models are universally superior, and model choice alone does not certify a feature. Compare measured latency and predictive performance; see https://scikit-learn.org/stable/computing/computational_performance.html.' FROM public.quiz_questions WHERE id='2b3a41bc-f53a-4635-9ecd-57e17693adbe'),'factual quiz correction applied');
SELECT public.test_assert((SELECT description='Apply LQR to an altitude-control model. Define the state, dynamics and quadratic cost weights, then inspect the resulting closed-loop response and its assumptions.' FROM public.capsules WHERE id='89f71ecd-75a3-44b5-8b3d-f6bda261e51a'),'lesson description improved');
SELECT public.test_assert((SELECT description='Train a PPO policy in MetaDrive and compare reproducible scenario results with the classical-control projects. Examine reward design and failures without assuming either method is universally better.' FROM public.capsules WHERE id='8baf91a5-2203-4550-89e9-0c1645e8adfc'),'lesson description improved');
SELECT public.test_assert((SELECT description='Explore trajectory tracking with MPC. Identify the prediction model, cost, encoded constraints and solver behavior, then test tracking and constraint violations under declared conditions.' FROM public.capsules WHERE id='23845fe2-4ac2-477e-a56a-89ed6a21367c'),'lesson description improved');
SELECT public.test_assert((SELECT description='Apply LQR to a lane-keeping model. Examine state errors, speed assumptions, cost weights and steering limits when evaluating the simulated controller.' FROM public.capsules WHERE id='561a6a5d-e458-409b-878d-1a3e3d336fe7'),'lesson description improved');
SELECT public.test_assert((SELECT description='Practise modern C++ with the associated build and test tools. Use the material to prepare for the ACC implementation and to examine ownership, testing and runtime requirements.' FROM public.capsules WHERE id='51ceb9f5-eb49-4690-86d1-79021921a7a1'),'lesson description improved');
SELECT public.test_assert((SELECT content_value='# Welcome

This course studies longitudinal and lateral vehicle models, feedback control, estimation and simulation projects using PID, LQR, MPC and reinforcement learning. These methods share important ideas, but have different objectives, assumptions and implementation tradeoffs.

The project sequence includes ACC, linear-control analysis, planning/control integration, PPO in MetaDrive, electronic stability control, LQR examples and MPC trajectory tracking. Reproduce the relevant examples and keep an explicit record of your model, units, sample interval, limits and evaluation conditions.

Begin with the Python and C++ foundations you need, then study longitudinal dynamics before moving to planning, reinforcement learning, lateral models/estimation and MPC. You will need linear algebra for state-space models and optimal control; revisit it when the equations stop being interpretable.

The study guide on this page provides a common experiment and comparison rubric. Work in simulation and distinguish evidence obtained on a model from evidence about target hardware or a physical vehicle. There is no automatic progression in which one controller is always superior to the previous one.' FROM public.capsule_content WHERE id='dd881bf9-2e86-4bb5-b739-3cda732a9cd6'),'text correction applied');
SELECT public.test_assert((SELECT content_value='## Reinforcement learning as a comparison

Use the lecture, slides and MetaDrive PPO project to investigate a policy learned through interaction. Its behavior depends on the observations, action space, rewards, training distribution and environment rules.

Compare the policy with a declared baseline on reproducible held-out scenarios. Report tracking or task success, failures, constraint violations and execution requirements alongside reward. Learned control is not automatically better than a classical controller, and a classical design''s guarantees apply only under its stated assumptions.

The next module introduces lateral vehicle models and estimation. Keep the distinction between a learned policy and the dynamics of the plant it acts on.' FROM public.capsule_content WHERE id='4500e16d-b812-4c15-9ac3-d6230ac71c3a'),'text correction applied');
SELECT public.test_assert((SELECT content_value='## Lateral dynamics, estimation and optimal control

The lecture and slides introduce bicycle and tire models, ABS/TCS/ESC concepts, state estimation and optimal control. The associated projects cover ESC in Simulink, altitude control with LQR and lane keeping with LQR.

For each example, identify the model state, input and operating assumptions. LQR computes a feedback gain for a specified quadratic cost and linear model; choosing the states and weights remains an engineering design task. Examine actuator limits and estimated-state errors before interpreting a simulated result.

The [LQR reference](https://www.mathworks.com/help/control/ref/lti.lqr.html) explains the model, weights and resulting gain. Next, study MPC as another way to pose a prediction-and-control problem, particularly when constraints need to be represented explicitly.' FROM public.capsule_content WHERE id='3b2ca858-4578-4d3c-9339-d90c01878e8e'),'text correction applied');
SELECT public.test_assert((SELECT content_value='## Model Predictive Control for trajectory tracking

Start with the MPC introduction and project explanation, then run the trajectory-tracking repository where the required dependencies are available.

Identify the prediction model, horizon, reference, cost weights and constraints implemented in the example. MPC repeatedly solves a finite-horizon problem and applies the next control action; the [MPC reference](https://www.mathworks.com/help/mpc/ref/mpc.html) describes this structure. Distinguish hard constraints from penalized soft constraints and check solver outcomes.

LQR also optimizes future cost, with finite- and infinite-horizon formulations. Its usual unconstrained formulation does not directly impose hard input limits. MPC is useful when a suitable formulation needs constraints and prediction, but its feasibility, computation and tracking performance must be evaluated for the actual design.

Complete the study-guide comparison and report both successful cases and limits.' FROM public.capsule_content WHERE id='4acc9c99-2da2-4ae9-a89f-8dbb7325c4cf'),'text correction applied');
SELECT public.test_assert((SELECT content_value='# Review your controller evidence

The projects provide opportunities to study ACC, stability analysis, planning/control integration, PPO, ESC, LQR and MPC. Mark an exercise complete when you can reproduce its behavior, explain its assumptions and identify at least one condition under which its conclusions may fail.

A useful portfolio contains the plant model and units, controller parameters, test scenarios, measured outputs and a failure analysis. Compare methods on the same engineering requirement rather than assuming that a newer or more complex algorithm is better.

If you extend the C++ work, measure the relevant runtime properties and test its interfaces. If you investigate a physical plant, use an appropriately supervised laboratory setup and an explicit test plan; simulation can represent noise and lag when they are modeled, but cannot supply evidence about effects it omits.

The ADAS course adds practice with requirements and a simulated feature-development workflow. The AI Bootcamp expands the machine-learning material. Choose the next topic from a specific limitation in your current evidence, and state that limitation in your project README.' FROM public.capsule_content WHERE id='225b6592-4e1a-4c64-9dbc-332e2e7ec9f2'),'text correction applied');
SELECT public.test_assert((SELECT description='Use a Jenkinsfile to make build steps reviewable with the application. Intentionally fail a check, confirm later delivery stages do not run, then restore it and compare the two build records; do not treat a green job as proof without inspecting what it tested.' FROM public.capsules WHERE id='0c84f8fe-a07b-42a7-8b47-1671051693e3'),'lesson description improved');
SELECT public.test_assert((SELECT description='Walk through a small change from an isolated branch to a reviewed commit and remote push. Inspect the diff before committing, capture the resulting commit ID, and explain how that ID should follow the change into its build artifact.' FROM public.capsules WHERE id='1c886871-0758-4292-8861-ec4b4b90a7b4'),'lesson description improved');
SELECT public.test_assert((SELECT description='Describe continuous integration as an automated check of a specific revision, then map checkout, test, and build into Jenkins stages. Define which failures must stop the pipeline and preserve a log that identifies the failing stage and source commit.' FROM public.capsules WHERE id='1d7b8071-23a4-48c4-a937-ce4772937397'),'lesson description improved');
SELECT public.test_assert((SELECT description='Build confidence with paths, files, pipes, permissions, and exit codes before running deployment commands. Use the linked Linux resource to assemble a short command log that shows where a file lives, who can read it, and whether each command succeeded.' FROM public.capsules WHERE id='3647292d-a48c-4c3e-8bdd-9f62264c35e2'),'lesson description improved');
SELECT public.test_assert((SELECT description='Complete a small deployment and verify it from outside the Pod using a Service or port forwarding. Record the image version, readiness result, and response body, then rehearse a controlled rollback and confirm which version is serving afterward.' FROM public.capsules WHERE id='3944066e-6f21-4d55-bada-c932b0618034'),'lesson description improved');
SELECT public.test_assert((SELECT description='Explain how a Deployment maintains Pods and how a Service selects their endpoints. Trace labels, selectors, image identity, and ports through a minimal application, then use rollout status and Pod events to verify the result.' FROM public.capsules WHERE id='46a41fd8-8e0b-4452-a92a-621cc0f08821'),'lesson description improved');
SELECT public.test_assert((SELECT description='Set up a practice repository and complete the add, commit, status, log, and push cycle. Verify the change on the remote and leave credentials outside committed files; use the linked recording alongside your own command transcript.' FROM public.capsules WHERE id='4776be97-655e-4c13-a10d-4b65339459cb'),'lesson description improved');
SELECT public.test_assert((SELECT description='Practice a repeatable command-line investigation: inspect the current directory and environment, locate a process, read its logs, and check its exit status. Keep a small troubleshooting checklist so a failed build produces evidence rather than a sequence of guesses.' FROM public.capsules WHERE id='575a15fd-b99c-49af-9f7f-e274fdfd6bfe'),'lesson description improved');
SELECT public.test_assert((SELECT description='Distinguish your working tree, the staging area, and committed history, then connect a local repository to a GitHub remote. Use the linked guide to explain what is shared by a push and what remains only on your computer.' FROM public.capsules WHERE id='61530bee-5ff0-479d-8376-b549177a30b0'),'lesson description improved');
SELECT public.test_assert((SELECT description='Connect a Jenkins job to the agent, workspace, parameters, and credentials it needs. Produce a short environment checklist: a pipeline definition alone does not install Python, Docker, kubectl, registry permissions, or access to a cluster.' FROM public.capsules WHERE id='66056e7f-9d03-4c3a-bd6c-cabb807c6ce7'),'lesson description improved');
SELECT public.test_assert((SELECT description='Connect Linux processes, environment variables, and filesystem permissions to the machine that runs a delivery pipeline. Record how you would identify a running service, inspect its output, and diagnose a permission failure without relying on a graphical interface.' FROM public.capsules WHERE id='72cf8170-a34f-4c7d-ba01-9e1e80a7af02'),'lesson description improved');
SELECT public.test_assert((SELECT description='Implement the parameterized project with your own repository, registry, and local cluster settings. Use the added verification lab to test the application itself, identify the deployed revision, and demonstrate that a failed check prevents delivery before presenting your final pipeline.' FROM public.capsules WHERE id='78cd0331-43e9-47b4-8cb8-2f4ba5ea887e'),'lesson description improved');
SELECT public.test_assert((SELECT description='Distinguish a Docker image from its running containers and Docker Hub from the local image store. Use your own registry namespace and a scoped access token, then verify that another environment can retrieve the intended image.' FROM public.capsules WHERE id='793bb3e5-0bcb-4334-b2ce-b2f4ba20da3a'),'lesson description improved');
SELECT public.test_assert((SELECT description='Turn the delivery workflow into an operational blueprint: prerequisites, stage inputs and outputs, credentials, failure gates, and recovery steps. Explain the boundary between automatically validating a change and deciding whether it should reach a particular environment.' FROM public.capsules WHERE id='7a5ae5d3-067b-422d-b317-3ce5c44b336f'),'lesson description improved');
SELECT public.test_assert((SELECT description='Trace a single application change through Git, Jenkins, Docker, and Kubernetes using the linked implementation recording as a companion. Build an evidence chain from commit ID to image identity to deployed response, including the checks that can stop delivery.' FROM public.capsules WHERE id='7e4eef38-d272-4f8d-95fe-c9b9d97b9f22'),'lesson description improved');
SELECT public.test_assert((SELECT description='Follow one image through build, local execution, and registry publication. Record its repository, tag, and digest, verify the exposed application response, and explain why rebuilding or reusing a mutable tag can change what another machine receives.' FROM public.capsules WHERE id='840a9885-e61a-49dc-8d5b-32239359f818'),'lesson description improved');
SELECT public.test_assert((SELECT description='Use a local Minikube cluster to practice deployment without requiring a production account. Confirm the kubectl context and namespace, choose how the cluster obtains its image, and separate image-pull failures from application-startup failures.' FROM public.capsules WHERE id='daf58122-b6b9-4005-bc9b-c92b5535212b'),'lesson description improved');
SELECT public.test_assert((SELECT description='Read a Dockerfile as an explicit description of runtime files and startup behavior. Identify the base image, build context, working directory, copied files, and process command, then check that the container works without depending on an unmounted file from your laptop.' FROM public.capsules WHERE id='fff16f36-63ed-4455-9b12-4f66b7c6abc3'),'lesson description improved');
SELECT public.test_assert((SELECT content_value='# End-to-End Project: Your Commit → Your Cluster

This project template uses your own repository and registry variables. It assumes a Linux-compatible shell, Python 3, Git with an author identity, Docker, Jenkins agents with the required tools, and access to a learning cluster. Commands and authentication still need to match your environment. Use the added verification lab for stronger release-identity and failure-gate checks.

## 0. Your variables (set once)

```bash
export GITHUB_USER="<your-github-username>"
export DOCKERHUB_USER="<your-dockerhub-username>"
export APP_NAME="cicd-demo"
export IMAGE="$DOCKERHUB_USER/$APP_NAME"
export K8S_NAMESPACE="demo"
```

Put these in your shell profile (or a `.env` you `source`) so every step below
is copy-paste. Wherever a file cannot read your shell (Jenkinsfile, YAML), we
inject them explicitly — that is the whole trick that makes this repeatable.

## 1. The application repository

```bash
git init "$APP_NAME" && cd "$APP_NAME"
# app.py — a minimal web app; any language works, the pipeline is the point
cat > app.py <<''PY''
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
class H(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.end_headers()
        self.wfile.write(b"pipeline works!")
if __name__ == "__main__":
    HTTPServer(("0.0.0.0", int(os.environ.get("PORT", "8080"))), H).serve_forever()
PY
cat > test_app.py <<''PY''
import threading, unittest
from http.server import ThreadingHTTPServer
from urllib.request import urlopen
from app import H

class ApplicationContract(unittest.TestCase):
    def test_http_response(self):
        # Port zero selects a free local port; parallel tests cannot collide.
        server = ThreadingHTTPServer(("127.0.0.1", 0), H)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with urlopen(f"http://127.0.0.1:{server.server_port}", timeout=2) as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(response.read(), b"pipeline works!")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)
PY
git add -A && git commit -m "app + test"
git branch -M main
git remote add origin "git@github.com:$GITHUB_USER/$APP_NAME.git"
git push -u origin main
```

## 2. The Dockerfile

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY app.py .
EXPOSE 8080
CMD ["python", "app.py"]
```

```bash
docker build -t "$IMAGE:local" .
docker run -d -p 8080:8080 "$IMAGE:local" && curl localhost:8080
```

## 3. Jenkins credentials (one-time, per user)

In Jenkins → Manage Jenkins → Credentials, add:
- `dockerhub-creds` — your Docker Hub username + access token
- `github-creds` — your GitHub credentials (or use a public repo)

The Jenkinsfile refers to credentials **by these IDs**, never by value — that
is what lets every student use their own accounts unchanged.

## 4. The Jenkinsfile (parameterized)

```groovy
pipeline {
  agent any
  environment {
    IMAGE = "${env.DOCKERHUB_USER}/${env.APP_NAME}"
  }
  parameters {
    string(name: ''DOCKERHUB_USER'', defaultValue: ''CHANGE-ME'')
    string(name: ''APP_NAME'', defaultValue: ''cicd-demo'')
  }
  stages {
    stage(''Test'')  { steps { sh ''python3 -m unittest -v'' } }
    stage(''Build'') { steps { sh ''docker build -t $IMAGE:$BUILD_NUMBER .'' } }
    stage(''Push'')  {
      steps {
        withCredentials([usernamePassword(credentialsId: ''dockerhub-creds'',
            usernameVariable: ''DH_USER'', passwordVariable: ''DH_TOKEN'')]) {
          sh ''echo "$DH_TOKEN" | docker login -u "$DH_USER" --password-stdin''
          sh ''docker push $IMAGE:$BUILD_NUMBER''
        }
      }
    }
    stage(''Deploy'') {
      steps {
        sh ''sed "s|__IMAGE__|$IMAGE:$BUILD_NUMBER|" k8s/deployment.yaml | kubectl apply -f -''
      }
    }
  }
}
```

Add a GitHub webhook: repo → Settings → Webhooks →
`http://<your-jenkins-host>/github-webhook/` — push events.

## 5. Kubernetes manifests (image is a placeholder)

`k8s/deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: cicd-demo }
spec:
  replicas: 2
  selector: { matchLabels: { app: cicd-demo } }
  template:
    metadata: { labels: { app: cicd-demo } }
    spec:
      containers:
        - name: app
          image: __IMAGE__        # substituted by the pipeline — never hardcoded
          ports: [ { containerPort: 8080 } ]
---
apiVersion: v1
kind: Service
metadata: { name: cicd-demo }
spec:
  selector: { app: cicd-demo }
  ports: [ { port: 80, targetPort: 8080 } ]
  type: NodePort
```

```bash
minikube start
kubectl create namespace "$K8S_NAMESPACE" || true
kubectl config set-context --current --namespace="$K8S_NAMESPACE"
```

## 6. Run the loop

```bash
echo "# trigger" >> app.py
git commit -am "pipeline test" && git push
# webhook → Jenkins: Test → Build → Push → Deploy
kubectl get pods -w
minikube service cicd-demo -n "$K8S_NAMESPACE"
```

## 7. Checklist — proof it is user-agnostic

- [ ] No username appears in any committed file (only `$VARS` and `__IMAGE__`)
- [ ] A classmate can clone your repo, set THEIR variables, and deploy
- [ ] Rolling back is one command: `kubectl rollout undo deployment/cicd-demo`


## Agent prerequisites and verification

The Jenkins agent must have Python 3, Docker access, kubectl, and an authorized kubeconfig for the intended learning cluster. Credentials configured in an interactive shell are not automatically available to Jenkins. Ensure its current context and namespace are correct before enabling the Deploy stage. Never attach production credentials to an untrusted student build.

The HTTP test above checks the actual application response instead of unrelated arithmetic. Keep its nonzero exit status as a delivery gate. After deployment, inspect rollout status and check the response through the cluster. Follow the added verification lab to carry the source revision into the image and served response.
' FROM public.capsule_content WHERE id='696beb6c-95aa-42a7-9a51-739f10601be7'),'text correction applied');
SELECT public.test_assert((SELECT description='Practice the programming and data-structure foundations needed for planner implementations: lists, mappings, sets, functions, and priority-based search. Use the linked notebook to build small testable routines and explain the cost of the operations used inside a search loop.' FROM public.capsules WHERE id='01312645-5c8b-4f89-b67d-b8f6ae7c1055'),'lesson description improved');
SELECT public.test_assert((SELECT description='Prepare to analyze planner experiments by organizing runs, computing summary statistics, and plotting outcomes. Define units and missing-value handling, keep scenario identifiers alongside results, and separate evaluation data from parameters you tune.' FROM public.capsules WHERE id='0f3ec710-997c-4e02-94e0-3a1873ef8b20'),'lesson description improved');
SELECT public.test_assert((SELECT description='Work through the two linked Python notebooks to review functions, iteration, indexing, and numerical data handling. Build a small deterministic example with assertions so later planning notebooks have a reliable starting point and reproducible inputs.' FROM public.capsules WHERE id='191393a5-fe83-4eb5-86a8-b4cfd4f85a80'),'lesson description improved');
SELECT public.test_assert((SELECT description='Use the linked FSM notebook to make behavior decisions explicit as states, transition guards, and available actions. Record why each transition occurs, test blocked-lane situations, and check whether hysteresis or a dwell condition is needed to avoid rapid switching.' FROM public.capsules WHERE id='420f5cf8-d26a-4128-8e22-c45945b0319e'),'lesson description improved');
SELECT public.test_assert((SELECT description='Audit the experiments you have actually completed and assemble a reproducible planning portfolio. Compare classical and learned methods only where both implementations and matched evaluation scenarios are available; list unfinished early-access topics as future work.' FROM public.capsules WHERE id='49ec9ebd-cb29-47fe-831d-dcb928555deb'),'lesson description improved');
SELECT public.test_assert((SELECT description='Study the linked lecture with a focus on how learning changes the planner development loop. Identify what is learned, what remains part of the environment or objective, and which measurements are needed to compare a learned policy with a rule-based controller.' FROM public.capsules WHERE id='4a0fb576-3546-4700-b2f0-04ebbbb075d7'),'lesson description improved');
SELECT public.test_assert((SELECT description='Use the two lecture resources to organize the responsibilities of motion prediction and planning. As you study, maintain a diagram of inputs, decisions, constraints, and outputs; distinguish a geometric path from a time-parameterized trajectory and the controller that follows it.' FROM public.capsules WHERE id='4b5a77b6-2ebb-45ba-aa6a-ddb1cb8ef118'),'lesson description improved');
SELECT public.test_assert((SELECT description='Use the uncertainty-planning lecture to identify which inputs are uncertain and how that uncertainty affects a decision. Formulate at least two plausible future scenarios and explain what evidence would justify continuing, slowing, or choosing another maneuver.' FROM public.capsules WHERE id='64f1e998-1609-4ed7-9e8f-4067d9576155'),'lesson description improved');
SELECT public.test_assert((SELECT description='Orient yourself to route search, behavior decisions, local trajectories, prediction, and learned planning. This course is early access: use the resources currently attached to each lesson and distinguish an implemented experiment from a planned curriculum topic.' FROM public.capsules WHERE id='8bec6954-2ea9-4237-8eb2-970938f497c9'),'lesson description improved');
SELECT public.test_assert((SELECT description='Use SQL practice to make experiment records queryable: filter scenarios, group outcomes, and join configuration metadata with results. Treat this as a supporting data skill and write a query that compares completion and collision counts without counting duplicate runs twice.' FROM public.capsules WHERE id='8f7e7ccf-aec9-421a-85ce-c8e4e606d4d6'),'lesson description improved');
SELECT public.test_assert((SELECT description='Implement and visualize A* on a grid using the linked global-planning notebook. State the movement model and heuristic, check obstacle avoidance and total path cost, and include an unreachable map so the planner is tested beyond a successful animation.' FROM public.capsules WHERE id='ac2b000f-0ef8-494d-8e72-31ecb1206d8b'),'lesson description improved');
SELECT public.test_assert((SELECT description='Work through the two notebooks and presentation while recording dependencies, random seeds, training settings, and evaluation conditions. Produce a compact experiment table rather than relying on one favorable rollout, and distinguish optimization reward from collision or completion metrics.' FROM public.capsules WHERE id='b596143a-4c4a-4570-91f0-db2510ff0551'),'lesson description improved');
SELECT public.test_assert((SELECT description='Use the linked algorithms notebook to connect state representation, expansion rules, stopping conditions, and complexity. Before optimizing runtime, verify that a candidate search respects obstacles, reconstructs a valid path, and reports unreachable goals explicitly.' FROM public.capsules WHERE id='bf03de87-f50c-499d-a066-4fbc7be71ded'),'lesson description improved');
SELECT public.test_assert((SELECT description='Connect a behavior choice to candidate local paths and speed profiles using the lattice-planning notebook. Compare feasibility, clearance, acceleration, and smoothness before selecting a candidate; a visually smooth curve can still collide or exceed the vehicle assumptions.' FROM public.capsules WHERE id='d78954dc-c79c-49a4-9ba0-42b47afd6e7a'),'lesson description improved');
SELECT public.test_assert((SELECT description='Use the accompanying presentation to consolidate definitions and compare the planning layers introduced in this module. Write a short glossary and annotate one driving scenario with the route, behavior, trajectory, and prediction information needed at each step.' FROM public.capsules WHERE id='d888ad37-8923-4552-b17f-37868ddc3ce7'),'lesson description improved');
SELECT public.test_assert((SELECT description='Use the linked PPO project to identify the environment observations, actions, reward, termination rules, and training settings. Keep evaluation scenarios separate from training and compare closed-loop outcomes against a simple baseline before interpreting a high reward as good driving.' FROM public.capsules WHERE id='e37b67d1-7855-4f56-9f99-7e47c7cfed5a'),'lesson description improved');
SELECT public.test_assert((SELECT description='Use the linked study resources to connect uncertainty representations with planner evaluation. Document the assumed prediction errors, test a scenario outside nominal conditions, and compare the chosen action and clearance rather than treating one predicted future as certain.' FROM public.capsules WHERE id='e7f64c4c-3e48-4be8-979e-65de8494aa5b'),'lesson description improved');
SELECT public.test_assert((SELECT description='Combine the attached map, planning material, lecture resources, and Intelligent Driver Model reference into a documented experiment. State vehicle and traffic assumptions, inspect time-step sensitivity, and report what happens when initial spacing or lead-vehicle behavior changes.' FROM public.capsules WHERE id='f7daf6bc-b152-4e5e-b814-056e030876aa'),'lesson description improved');
SELECT public.test_assert((SELECT content_value='# Welcome

Planning connects a representation of the scene to the motion a vehicle should attempt. This course is early access: use the recordings, notebooks, and reading links currently attached to each lesson, and treat the broader curriculum as the direction of study rather than proof of completed modules.

## A practical sequence

Start with the programming foundations, then the introduction to prediction and planning. In Rule Based Motion Planning, work through grid-based global search, behavior decisions with an FSM, candidate local trajectories, and the linked project resources. Use the deep-learning and uncertainty material to examine what changes when policies are learned or future behavior is uncertain.

A route, a behavior decision, and a trajectory answer different questions. Write down the inputs, outputs, assumptions, and failure conditions for each component before connecting them. The added planning lab gives you a runnable A* baseline with an unreachable-case check and an evaluation rubric.

## Evaluate what actually runs

The curriculum includes PPO and other learned-planning topics. A notebook link does not establish that a trained policy, evaluation environment, or every planned module is complete. Compare classical and learned methods only when both implementations run under declared, matched conditions. Record missing dependencies or unfinished topics as future work.

Start with the Python and algorithms notebooks if you need the foundations, or the introduction lecture if those are already comfortable.
' FROM public.capsule_content WHERE id='0d257147-0235-4df0-adcf-e4c7f3108ba1'),'text correction applied');
SELECT public.test_assert((SELECT content_value='# Where to go from here

Assemble the planning experiments you have actually completed. Include the map, movement model, collision assumptions, scenario settings, code, and measured results. A successful animation alone is not a complete evaluation.

## Your portfolio

Show a working classical baseline and an explicit failure case. Connect a behavior decision to a feasible trajectory where you have implemented that interface. If you also have a runnable PPO agent, compare it against the baseline on the same held-out scenarios and report collisions, completion, and travel time separately from reward. If that implementation is not complete, identify it as an extension rather than claiming a finished comparison.

This course is early access. Keep a list of the released resources you used and the planned topics you have not yet implemented.

## Possible next steps

**Advanced Driver Assistance Systems (ADAS): Engineering & Development** provides broader system context for perception, planning, control, and validation.

**Modern Vehicle Control (PID → LQR → MPC)** develops the control layer. Study vehicle dynamics and tracking limits before assuming that a geometric path can be followed by a physical vehicle.

Use the added planning lab''s rubric to decide which evidence is still missing from your report.
' FROM public.capsule_content WHERE id='1640a8a5-181a-4eeb-9d7b-65a0e45b29f5'),'text correction applied');
SELECT public.test_assert((SELECT description='Identify what you will measure before opening the playground: pixel projection, depth, semantic overlap, or motion. Use the added lab guide to choose controlled experiments and a results table so each interaction answers a specific question.' FROM public.capsules WHERE id='308a971a-1f4e-44b2-a66e-f3acc631425a'),'lesson description improved');
SELECT public.test_assert((SELECT description='Use the linked lecture as the theory companion to your playground experiments. Keep track of coordinate frames, assumptions, and output units, then explain how a calibration or timing error could affect the world representation delivered to a planner.' FROM public.capsules WHERE id='93dc53ef-90ec-473d-b91e-83f3aea135ea'),'lesson description improved');
SELECT public.test_assert((SELECT description='Plan a practical route through the perception playground, lecture, and slides. Start with camera geometry and measurable outputs, then connect semantics, depth, motion, reconstruction, and generative topics while keeping a notebook of assumptions and observed failure cases.' FROM public.capsules WHERE id='b2c3422a-0ed5-4500-8192-43451ec79d83'),'lesson description improved');
SELECT public.test_assert((SELECT description='Turn your playground observations into a small perception report with reproducible inputs, expected results, and limitations. Choose a next step in real-data perception or ADAS only after identifying which uncertainty or failure case your current experiment leaves unresolved.' FROM public.capsules WHERE id='e1eb67de-513d-4379-b356-04640879731b'),'lesson description improved');
SELECT public.test_assert((SELECT description='Use the linked interactive playground to vary one perception parameter at a time and record the effect. Compare your observations with the synthetic camera and stereo exercise, and distinguish an appealing visualization from a measurement checked against known geometry.' FROM public.capsules WHERE id='eb72112b-7f4f-4087-b075-cfbdc2e1db0a'),'lesson description improved');
SELECT public.test_assert((SELECT description='Use the presentation to revisit the definitions and geometric relationships behind your experiments. Re-derive one projection or depth example with explicit units and write down the conditions under which that relationship stops being a useful model.' FROM public.capsules WHERE id='fc5dbfc2-80da-4871-9546-1cdf07f51ac6'),'lesson description improved');
SELECT public.test_assert((SELECT count(*)=6 FROM public.capsule_content WHERE metadata->>'editorial_release'='2026-10-19'),'one study guide for each published course, no duplicates');
SELECT public.test_assert((SELECT count(*)=8 FROM public.quizzes WHERE order_index=1000 AND is_graded=false AND is_published=true AND max_attempts IS NULL),'eight optional unlimited formative quizzes');
SELECT public.test_assert((SELECT count(*)=24 FROM public.quiz_questions q JOIN public.quizzes quiz ON quiz.id=q.quiz_id WHERE quiz.order_index=1000 AND jsonb_typeof(q.correct_answer)='string' AND length(q.explanation)>=35),'24 supported scalar-answer practice questions');
SELECT public.test_assert((SELECT content_value='https://example.com/existing-lecture' AND title='Existing lecture reference' AND metadata='{"fixture":"preserve"}'::jsonb FROM public.capsule_content WHERE id='70000000-0000-4000-8000-000000000001'),'existing media references unchanged');
SELECT public.test_assert((SELECT score=77 AND max_score=100 AND passed AND answers='{"historical":"preserve"}'::jsonb FROM public.quiz_attempts WHERE id='70000000-0000-4000-8000-000000000002'),'historical quiz attempt and grade unchanged');

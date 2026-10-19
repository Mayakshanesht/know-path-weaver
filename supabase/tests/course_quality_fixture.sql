-- Portable audited baseline subset for the editorial migration tests.
-- Contains teaching material only; no production learner records.

INSERT INTO public.courses(id,title,description,price_india,price_international,is_published) VALUES
('190adb5e-be9a-4bd5-9d34-19dd6bc23e9b','KnowGraph''s Perception lab for computer Vision','A hands-on progression through the perception stack: how an image is formed, what is in it, where it sits in 3D, how it moves, and how modern models reason about and generate it.',999,9.99,true),
('64c67e86-4327-42e1-bef3-7841c70719d6','AI Bootcamp for Autonomous Driving','For engineers who want to build real AI systems for autonomous driving rather than study isolated algorithms. Foundations, then system-level thinking, then deployable autonomy projects.',9999,149,true),
('699a4120-587c-48a6-bda6-570ba0b29377','CI/CD Foundations: From Git Commit to Kubernetes Cluster','Continuous Integration And Continuous deployment',3999,49,true),
('9078b1a0-fc12-4808-ad21-98ed4e94b70c','Advanced Driver Assistance Systems (ADAS): Engineering & Development','How ADAS systems are actually built — from perception and machine learning through control and functional safety. For engineers who want to move beyond theory and build feature-level ADAS systems using industry-style workflows.',9999,149,true),
('dd0ce657-1483-4984-9f80-fbb81e41622d','Advanced Vehicle Dynamics & Control: From Modern C++ to Predictive Autonomy','Vehicle-dynamics–driven control design, which sits at the core of real ADAS features. Connects PID, LQR and MPC as one unified control framework rather than a set of disconnected techniques.',4999,49,true),
('ff819242-209a-4105-b598-afe6561ef1e9','Advanced Motion Planning for Autonomous Driving','EARLY ACCESS. The full 10-module curriculum is set and the modules are being released as they are built — you can read every one below before deciding. Enrol now at the early-access price and each module lands in your account as it ships, at no extra charge. Practical planning and prediction, from classical search through to closed-loop learned planners: traditional planning, global planning, behaviour planning with FSMs, lattice planners, end-to-end RL with PPO, closed-loop ML planners, motion prediction and MPDM.',4999,49,true);

INSERT INTO public.learning_paths(id,course_id,title,description,order_index) VALUES
('012a1cb3-599f-4ec1-af32-c187f7d67517','64c67e86-4327-42e1-bef3-7841c70719d6','Computer Vision for Autonomous Systems','Detection, segmentation and tracking on real driving data.',6),
('0a643110-a9a3-40f2-bcb6-d24f34b821cd','699a4120-587c-48a6-bda6-570ba0b29377','Orchestration - Kubernetes',NULL,4),
('0ae0fc67-4ddd-492d-9f5a-7786d7a971e6','dd0ce657-1483-4984-9f80-fbb81e41622d','Lateral Vehicle dynamics, Estimation and Optimal(LQR)/Predictive Control(MPC)','Steering, tyre models, and the estimators that recover the state you cannot measure — then LQR and MPC, where you specify what you want rather than tune how to get it. This is the heart of the course: the point where control stops being a set of gains and becomes an optimisation problem you pose.',6),
('18e49daf-6eee-44ef-b96e-f27004addb65','9078b1a0-fc12-4808-ad21-98ed4e94b70c','ADAS Capstone: AEB, ACC & LKA (Production Workflow)','The whole course in one build: emergency braking, adaptive cruise and lane keeping, taken through MIL and SIL to code generation and co-simulation in IPG CarMaker. Each piece is something you already know; the capstone is about the part nobody teaches, which is what happens when they all have to work at once, on the same vehicle, at the same time.',12),
('28f2fbb6-a5f3-47dc-9e94-470f47f502dc','dd0ce657-1483-4984-9f80-fbb81e41622d','Model Predictive Control for Trajectory Tracking','MPC applied to the real problem: track a trajectory while respecting the constraints the vehicle genuinely has. LQR was optimal but could not say the word "cannot"; MPC can, and that single difference — the ability to encode a limit rather than hope you stay inside it — is why it is what modern autonomy actually runs.',7),
('2ae9d578-0990-4c6c-a633-fb1859001fdd','190adb5e-be9a-4bd5-9d34-19dd6bc23e9b','Welcome',NULL,0),
('2d558713-c0b5-486f-b1d5-a93401af46e8','ff819242-209a-4105-b598-afe6561ef1e9','Basics','What this course is and what you will build.',0),
('39a39b93-3d6f-4a71-af76-0a33b147ba36','699a4120-587c-48a6-bda6-570ba0b29377',' End to End Implementation and Outro',NULL,5),
('3b06768a-3e35-452b-9427-d0d45cc9426d','9078b1a0-fc12-4808-ad21-98ed4e94b70c','Welcome',NULL,0),
('4347866e-7f79-4369-a040-f326efb55b90','9078b1a0-fc12-4808-ad21-98ed4e94b70c','Systems Engineering & Functional Safety for ADAS','Requirements, the V-model, ISO 26262, ASIL and the argument that a feature is safe enough to sell. Everything you have built so far could be technically excellent and still unshippable, because a safety case is not made of code — it is made of traceability from a hazard, through a requirement, to a test that passes.',11),
('4717d6b7-9ddb-4564-84c3-3d211a14697b','ff819242-209a-4105-b598-afe6561ef1e9','What next','Where to take this.',9),
('497c1e08-9802-4c86-a491-881e5a5957bd','64c67e86-4327-42e1-bef3-7841c70719d6','Foundations of Machine Learning','Introductory materials covering how machines learn, probability and unsupervised learning fundamentals, and additional study resources such as PDFs, a mind map, and a Colab notebook on ML algorithms.',2),
('4bd732a2-d361-4385-8b5d-7adf84560043','190adb5e-be9a-4bd5-9d34-19dd6bc23e9b','What next',NULL,2),
('5848c7f1-b0e9-4323-abbf-5a093ce8ea7c','ff819242-209a-4105-b598-afe6561ef1e9','Deep Learning and Reinforcement Learning','Deciding what to do: follow, overtake, yield.',3),
('5cf12e8b-b2ab-4774-a931-988e0477c848','dd0ce657-1483-4984-9f80-fbb81e41622d','Welcome',NULL,0),
('6114a8dd-8dd1-4bf2-8085-d63ded25bdc8','64c67e86-4327-42e1-bef3-7841c70719d6','Deep Learning and Reinforcement Learning','Neural networks, then agents that learn to drive.',5),
('6873445f-228e-4e32-905c-56f4a7739544','ff819242-209a-4105-b598-afe6561ef1e9','Rule Based Motion Planning','Route-level search across the road network.',2),
('77533d87-7dc5-473b-9673-eba676e09cd1','64c67e86-4327-42e1-bef3-7841c70719d6','What next',NULL,8),
('79e5c42f-91fb-4496-b7a1-ca63de39ef3a','9078b1a0-fc12-4808-ad21-98ed4e94b70c','Foundations of Machine Learning for ADAS','How learning from data actually works — generalisation, the bias-variance trade-off, and the failure modes that matter more here than anywhere else. It comes before the AEB project deliberately: you cannot reason about whether a braking classifier is safe until you can reason about why a model that scores 99% might still be dangerous.',4),
('952cd412-a53d-4bc1-bfb8-243c6e6897e2','699a4120-587c-48a6-bda6-570ba0b29377','Version Control Git and Git Hub',NULL,1),
('a41b4155-efa6-4db1-a354-bd9613953d72','dd0ce657-1483-4984-9f80-fbb81e41622d','Modern C++','Ownership, RAII, compiler-generated functions and the testing toolchain — C++ as it is written for real-time systems rather than as it is taught. Controllers ship in C++ because a garbage-collection pause of 50 ms in a braking loop is not slow, it is dangerous, and this module is where you stop prototyping and start writing code that could run on a vehicle.',2),
('baead384-856f-4cba-b24e-e179c4f155a8','ff819242-209a-4105-b598-afe6561ef1e9','Uncertainty Aware Motion Planning Frameworks','Turning a decision into a drivable trajectory.',4),
('becefbc1-0713-45ae-8bbf-7c537bcd9e99','699a4120-587c-48a6-bda6-570ba0b29377','Work Flow Automation Jenkins',NULL,2),
('c2bf28ca-7e77-48de-ab39-652ab9528ebe','699a4120-587c-48a6-bda6-570ba0b29377','Linux',NULL,0),
('c9af247f-52c4-405a-a515-ec585217b2dc','64c67e86-4327-42e1-bef3-7841c70719d6','Supervised Machine Learning','Regression, classification, ensembles — and your first AV project.',3),
('d0c175fb-23c7-457e-a4a3-3d0d8e2cbcd8','dd0ce657-1483-4984-9f80-fbb81e41622d','What next',NULL,8),
('d2dbe91a-c917-41c9-b2c1-975f2fae831c','ff819242-209a-4105-b598-afe6561ef1e9','Introduction to Motion Prediction & Planning for Autonomous Driving','The classical algorithms, and why they are still the backbone.',1),
('d4927cc0-073d-4fbb-8bf1-1fb4141c6eae','dd0ce657-1483-4984-9f80-fbb81e41622d','Reinforcement Learning','Learning a driving policy by acting rather than by being told, using PPO in a simulator. It comes after classical control on purpose — you now know what a well-understood, provable controller looks like, which is exactly what you need in order to judge honestly what RL buys you and what it costs you in explainability.',5),
('dc5977cf-e751-4b86-97ae-8f092701a827','190adb5e-be9a-4bd5-9d34-19dd6bc23e9b','The Perception Playground','Camera geometry, semantics, 3D structure, motion, and generative vision.',1),
('f7560d02-ba0a-4c22-9838-63e97b081dbb','9078b1a0-fc12-4808-ad21-98ed4e94b70c','Perception: Deep Learning & Reinforcement Learning','Moves from hand-designed features to learned ones — the deep networks that turn raw camera pixels into objects, lanes and free space, plus an introduction to policies learned by acting. Perception is the first stage of the pipeline, and everything downstream inherits its mistakes, so this is where the quality of the whole stack is set.',6),
('f9ff6723-29a9-4ede-8450-a9ab219e3a7d','699a4120-587c-48a6-bda6-570ba0b29377','Containerization - Docker & Docker hub',NULL,3),
('fcd58af5-c4ad-4379-8ebd-cc3247e1fd25','64c67e86-4327-42e1-bef3-7841c70719d6','Welcome',NULL,0);

INSERT INTO public.capsules(id,learning_path_id,title,description,duration_minutes,order_index) VALUES
('01312645-5c8b-4f89-b67d-b8f6ae7c1055','2d558713-c0b5-486f-b1d5-a93401af46e8','Fundamentals of Programming and Data structure',NULL,NULL,1),
('03e180d1-7eed-443b-b871-3e5b3caa7594','f7560d02-ba0a-4c22-9838-63e97b081dbb','Project 4 - RL based car control using Proximal Policy Optimization in Metadrive simulator','A PPO agent that learns to drive from reward alone. Nothing here is hand-written — no rules, no planner — so hold it against the rule-based stack you build next and be ready to argue for either.',30,5),
('0730b9ad-1532-4fd0-ad19-f8fc055c7df1','c9af247f-52c4-405a-a515-ec585217b2dc','AEB Project — Notebook, Code and Slides','The AEB project in full: the Colab notebook, the source repository, and the reference deck. One project, three artifacts.',30,8),
('07c8d901-3022-4cb5-8cf8-f6d5b111fdfb','4347866e-7f79-4369-a040-f326efb55b90','What this module covers','Start here — what this module covers and why it follows the last one.',3,0),
('0c84f8fe-a07b-42a7-8b47-1671051693e3','becefbc1-0713-45ae-8bbf-7c537bcd9e99','Jenkins CI','',0,2),
('0f3ec710-997c-4e02-94e0-3a1873ef8b20','2d558713-c0b5-486f-b1d5-a93401af46e8','Data Analysis Basics',NULL,NULL,2),
('191393a5-fe83-4eb5-86a8-b4cfd4f85a80','2d558713-c0b5-486f-b1d5-a93401af46e8','Python Basics Tutorial',NULL,NULL,5),
('1c886871-0758-4292-8861-ec4b4b90a7b4','952cd412-a53d-4bc1-bfb8-243c6e6897e2','The Basic Workflow',NULL,NULL,1),
('1d7b8071-23a4-48c4-a937-ce4772937397','becefbc1-0713-45ae-8bbf-7c537bcd9e99','Continuous Integration with Jenkins','',0,0),
('1f54f8da-ce1c-43f5-9edc-da3effd66ad2','fcd58af5-c4ad-4379-8ebd-cc3247e1fd25','Welcome','What this course is, who it is for, and what you will have built by the end.',3,0),
('23845fe2-4ac2-477e-a56a-89ed6a21367c','28f2fbb6-a5f3-47dc-9e94-470f47f502dc','Project 8: Trajectory Tracking with Model Predictive Controller(MPC)','MPC: optimise over a horizon while respecting the steering and acceleration limits the vehicle actually has. PID reacts and LQR is optimal but blind to constraints — this is the controller that sees ahead, and it is the most expensive to run.',120,2),
('308a971a-1f4e-44b2-a66e-f3acc631425a','dc5977cf-e751-4b86-97ae-8f092701a827','What this module covers','Start here — what this module covers and why it follows the last one.',3,0),
('3371eeb7-1255-4125-883a-62bf3c8a2041','28f2fbb6-a5f3-47dc-9e94-470f47f502dc','What this module covers','Start here — what this module covers and why it follows the last one.',3,0),
('3560d351-c6bc-4557-a6fb-018339a3f085','d4927cc0-073d-4fbb-8bf1-1fb4141c6eae','What this module covers','Start here — what this module covers and why it follows the last one.',3,0),
('3647292d-a48c-4c3e-8bdd-9f62264c35e2','c2bf28ca-7e77-48de-ab39-652ab9528ebe','Basic Commands','',0,0),
('3944066e-6f21-4d55-bada-c932b0618034','0a643110-a9a3-40f2-bcb6-d24f34b821cd','Quick Start','',0,2),
('3ecebff9-89fb-4799-a437-69b87d4b66a5','c9af247f-52c4-405a-a515-ec585217b2dc','Logistic Regression','The classifier every other classifier is measured against. If your neural network cannot beat it, the network is not the problem.',60,5),
('41c43401-5bd9-443e-ad19-b764a7223ed0','18e49daf-6eee-44ef-b96e-f27004addb65','MIL, SIL Testing and Code generation','Build the test harness, run model- and software-in-the-loop tests, then generate embedded code. This is the step that separates a model that works from a feature that ships.',65,6),
('420f5cf8-d26a-4128-8e22-c45945b0319e','6873445f-228e-4e32-905c-56f4a7739544','Behaviour Planning with FSM',NULL,NULL,1),
('4523f54c-06f8-48d5-a2b0-e9a67966dffc','6114a8dd-8dd1-4bf2-8085-d63ded25bdc8','RL — PPO Agent Driving in MetaDrive','An actor-critic agent that learns to drive end to end. No planner, no rules — just reward, and it is unsettling how well it works.',30,4),
('46a41fd8-8e0b-4452-a92a-621cc0f08821','0a643110-a9a3-40f2-bcb6-d24f34b821cd','Kubernetes Cluster Basics','',0,0),
('4776be97-655e-4c13-a10d-4b65339459cb','952cd412-a53d-4bc1-bfb8-243c6e6897e2','Fisrt Steps In Git And Github',NULL,NULL,2),
('49ec9ebd-cb29-47fe-831d-dcb928555deb','4717d6b7-9ddb-4564-84c3-3d211a14697b','What next','What you built, and where to take it.',3,0),
('4a0fb576-3546-4700-b2f0-04ebbbb075d7','5848c7f1-b0e9-4323-abbf-5a093ce8ea7c','Lecture',NULL,NULL,0),
('4b5a77b6-2ebb-45ba-aa6a-ddb1cb8ef118','d2dbe91a-c917-41c9-b2c1-975f2fae831c','Lecture','',0,0),
('51ceb9f5-eb49-4690-86d1-79021921a7a1','a41b4155-efa6-4db1-a354-bd9613953d72','Modern C++, GTest & CMake','The language production ADAS ships in, plus the build and test toolchain around it. Python is where you prototype; this is where it goes to run in a car.',131,1),
('561a6a5d-e458-409b-878d-1a3e3d336fe7','0ae0fc67-4ddd-492d-9f5a-7786d7a971e6','Project 7: Lane Keep Assist with Linear Quadratic Regulator (LQR)','The same optimal control, now steering a car in its lane. Same maths as the last lesson, real consequences.',60,6),
('56dd7a30-3797-4d6a-abf9-8114dc9fc1ed','6114a8dd-8dd1-4bf2-8085-d63ded25bdc8','Traffic Sign Classification (GTSRB)','A CNN on a real benchmark, with real class imbalance and real degraded images. The gap between a curated dataset and GTSRB is the gap between a paper and a product.',30,3),
('575a15fd-b99c-49af-9f7f-e274fdfd6bfe','c2bf28ca-7e77-48de-ab39-652ab9528ebe','Production CLI','',0,2),
('5a1f1b4f-32ff-4f2c-b13a-0064b10474f4','3b06768a-3e35-452b-9427-d0d45cc9426d','Welcome','What this course is, who it is for, and what you will have built by the end.',3,0),
('61530bee-5ff0-479d-8376-b549177a30b0','952cd412-a53d-4bc1-bfb8-243c6e6897e2','Git and Git Hub form chaos to control',NULL,NULL,0),
('64f1e998-1609-4ed7-9e8f-4067d9576155','baead384-856f-4cba-b24e-e179c4f155a8','Lecture',NULL,NULL,0),
('66056e7f-9d03-4c3a-bd6c-cabb807c6ce7','becefbc1-0713-45ae-8bbf-7c537bcd9e99',' The Automation Engine','',0,1),
('6952ae8a-ebaa-45b0-97ab-4a1b1b8e5aed','c9af247f-52c4-405a-a515-ec585217b2dc','Machine Learning Based AEB','Automatic Emergency Braking, trained and driven in the MetaDrive simulator. The first time your model failing means the car hits something.',60,9),
('6d783d1c-7784-4089-8bb8-a3fae4665ca0','497c1e08-9802-4c86-a491-881e5a5957bd','How Machines Learn','The shape of the problem before any algorithm: data, a model, a loss, an optimiser. Nearly every ML failure is a failure of the assumptions underneath, not of the code.',60,1),
('717d901c-6dcc-45c0-9514-6e66ac80f4ef','18e49daf-6eee-44ef-b96e-f27004addb65','What this module covers','Start here — what this module covers and why it follows the last one.',3,0),
('72cf8170-a34f-4c7d-ba01-9e1e80a7af02','c2bf28ca-7e77-48de-ab39-652ab9528ebe','Linux','',0,1),
('78cd0331-43e9-47b4-8cb8-2f4ba5ea887e','39a39b93-3d6f-4a71-af76-0a33b147ba36','Implementation','',0,2),
('793bb3e5-0bcb-4334-b2ce-b2f4ba20da3a','f9ff6723-29a9-4ede-8450-a9ab219e3a7d','Docker & Docker Hub','',0,1),
('7a5ae5d3-067b-422d-b317-3ce5c44b336f','39a39b93-3d6f-4a71-af76-0a33b147ba36','From Code to Cloud A Strategic Blueprint','',0,1),
('7b9e00ce-9405-4ade-8ab2-e0897265209f','012a1cb3-599f-4ec1-af32-c187f7d67517','KITTI — Tracking and Detection','Detection and tracking on the benchmark the entire field is built on. Every perception claim you will read is measured against this data.',30,3),
('7e4eef38-d272-4f8d-95fe-c9b9d97b9f22','39a39b93-3d6f-4a71-af76-0a33b147ba36','END to END Implementation Video','',0,0),
('840a9885-e61a-49dc-8d5b-32239359f818','f9ff6723-29a9-4ede-8450-a9ab219e3a7d','Docker Build Run Push','',0,0),
('89f71ecd-75a3-44b5-8b3d-f6bda261e51a','0ae0fc67-4ddd-492d-9f5a-7786d7a971e6','Project 6: Altitude control with Linear Quadratic Regulator(LQR)','LQR on a clean, tractable plant. It does not tune a gain — it solves for the optimal one, and the step from PID to LQR is the step from technician to engineer.',30,5),
('8baf91a5-2203-4550-89e9-0c1645e8adfc','d4927cc0-073d-4fbb-8bf1-1fb4141c6eae','Project 4: RL based AV Car control using Proximal Policy Optimization & Metadrive Simulator','A PPO agent that learns the driving policy instead of being given one. Put it beside the PID and planning work you have just done — one is derived and provable, the other is learned and often better.',30,3),
('8bec6954-2ea9-4237-8eb2-970938f497c9','2d558713-c0b5-486f-b1d5-a93401af46e8','Welcome','What this course is, and what you will build.',3,0),
('8f7e7ccf-aec9-421a-85ce-c8e4e606d4d6','2d558713-c0b5-486f-b1d5-a93401af46e8','SQL – Comprehensive',NULL,NULL,4),
('93dc53ef-90ec-473d-b91e-83f3aea135ea','dc5977cf-e751-4b86-97ae-8f092701a827','Perception — Lecture','The full lecture for The Perception Playground. The projects in this module assume it, so take it first.',120,2),
('9cb6c6c1-8bc3-4991-ad5c-fc8615c90988','d0c175fb-23c7-457e-a4a3-3d0d8e2cbcd8','What next','What you built, what it means, and where to go next.',3,0),
('9d0928d9-5b55-4a3e-b1f6-97c4a7ce426c','77533d87-7dc5-473b-9673-eba676e09cd1','What next','What you built, what it means, and where to go next.',3,0),
('ac2b000f-0ef8-494d-8e72-31ecb1206d8b','6873445f-228e-4e32-905c-56f4a7739544','Global Planning Tutorial ',NULL,NULL,0),
('b2c3422a-0ed5-4500-8192-43451ec79d83','2ae9d578-0990-4c6c-a633-fb1859001fdd','Welcome','What this course is, who it is for, and what you will have built by the end.',3,0),
('b4e0a008-5ee5-43c8-92d8-db45860a021c','c9af247f-52c4-405a-a515-ec585217b2dc','One Expert to a Dream Team','Why an ensemble beats any single model, and when it does not. This is the most reliable free win in applied ML.',60,3),
('b596143a-4c4a-4570-91f0-db2510ff0551','5848c7f1-b0e9-4323-abbf-5a093ce8ea7c','Study Material',NULL,NULL,1),
('bf03de87-f50c-499d-a066-4fbc7be71ded','2d558713-c0b5-486f-b1d5-a93401af46e8','Algorithms',NULL,NULL,3),
('ca8b1a70-2915-479d-8248-25f1b5d87170','0ae0fc67-4ddd-492d-9f5a-7786d7a971e6','What this module covers','Start here — what this module covers and why it follows the last one.',3,0),
('d78954dc-c79c-49a4-9ba0-42b47afd6e7a','6873445f-228e-4e32-905c-56f4a7739544','Local Planning with a Lattice Planner',NULL,NULL,2),
('d888ad37-8923-4552-b17f-37868ddc3ce7','d2dbe91a-c917-41c9-b2c1-975f2fae831c','Lecture Material ',NULL,NULL,1),
('daf58122-b6b9-4005-bc9b-c92b5535212b','0a643110-a9a3-40f2-bcb6-d24f34b821cd','Kubernetes & Minikube','',0,1),
('dde43f20-164c-47be-a89e-3e131104d6b1','497c1e08-9802-4c86-a491-881e5a5957bd','ML Algorithms — Notebook','Searching, sorting and pathfinding. The pathfinding here returns later as global planning — this is the same A* wearing different clothes.',30,4),
('e1eb67de-513d-4379-b356-04640879731b','4bd732a2-d361-4385-8b5d-7adf84560043','What next','What you built, what it means, and where to go next.',3,0),
('e2654ce3-3496-4267-8a4c-800acc603078','79e5c42f-91fb-4496-b7a1-ca63de39ef3a','Practice Project - ML Algorithms ','A runnable tour of the classical ML algorithms. Most production ADAS features are not deep networks — they are well-chosen classical models under a hard latency budget.',30,5),
('e37b67d1-7855-4f56-9f99-7e47c7cfed5a','6873445f-228e-4e32-905c-56f4a7739544','End-to-End Planning with RL (PPO)',NULL,NULL,3),
('e6f6a810-e164-4e5e-934e-258acb209ac0','5cf12e8b-b2ab-4774-a931-988e0477c848','Welcome','What this course is, who it is for, and what you will have built by the end.',3,0),
('e7f64c4c-3e48-4be8-979e-65de8494aa5b','baead384-856f-4cba-b24e-e179c4f155a8','Study Material',NULL,NULL,1),
('eb72112b-7f4f-4087-b075-cfbdc2e1db0a','dc5977cf-e751-4b86-97ae-8f092701a827','The Perception Playground','An interactive lab for the perception stack. Perception is far easier to build intuition for by changing something and watching what breaks than by reading about it.',45,1),
('f7daf6bc-b152-4e5e-b814-056e030876aa','6873445f-228e-4e32-905c-56f4a7739544','Motion Planning Project 2',NULL,NULL,4),
('f8cc1c01-9245-40dd-83c5-03f51d375377','6114a8dd-8dd1-4bf2-8085-d63ded25bdc8','What this module covers','Start here — what this module covers and why it follows the last one.',3,0),
('fc5dbfc2-80da-4871-9546-1cdf07f51ac6','dc5977cf-e751-4b86-97ae-8f092701a827','Perception — Slides','The slides from the The Perception Playground lecture. Use them to revisit a specific derivation without re-watching an hour of video.',15,3),
('fff16f36-63ed-4455-9b12-4f66b7c6abc3','f9ff6723-29a9-4ede-8450-a9ab219e3a7d','containerization','',0,2);

INSERT INTO public.capsule_content(id,capsule_id,content_type,title,content_value,description,order_index,metadata) VALUES
('0d257147-0235-4df0-adcf-e4c7f3108ba1','8bec6954-2ea9-4237-8eb2-970938f497c9','text','Welcome','# Welcome

Planning is the layer that decides what the car actually does. Perception tells you what is there; control tells you how to move. Planning is everything in between, and it is where most of the genuinely hard decisions live.

## What you will build

A planning stack, in layers:

- **Global planning** — route-level search across the road network
- **Behaviour planning with an FSM** — follow, overtake, yield
- **Local planning with a lattice planner** — turning a decision into a drivable trajectory
- **End-to-end planning with RL (PPO)** — a learned planner with no hand-written rules
- **Closed-loop ML planners** — learned planners judged in the loop, not on a log
- **Motion prediction** — what everything else is about to do
- **MPDM** — deciding by simulating candidate policies forward

## Why the order matters

Route, behaviour, trajectory. That decomposition is how essentially every production autonomy stack is organised, and you build each layer before seeing them compose. Then you replace the whole thing with a learned planner and argue about which was better.

**Start with Traditional Motion Planning.**',NULL,0,'{}'::jsonb),
('1640a8a5-181a-4eeb-9d7b-65a0e45b29f5','49ec9ebd-cb29-47fe-831d-dcb928555deb','text','What next','# Where to go from here

You have built the planning stack twice — once classically, once learned — and you should now be able to argue for either without hand-waving.

## What to do with it

**Publish the lattice planner and the PPO agent side by side.** The comparison is the interesting artifact, not either one alone.

## Where to go from here

**Advanced Driver Assistance Systems (ADAS): Engineering & Development** puts planning where it belongs — one component of a safety-critical system that also has to perceive, control, and survive a functional safety review.

**Modern Vehicle Control (PID → LQR → MPC)** is the layer immediately below you. A planner that ignores the vehicle''s dynamics produces trajectories no controller can follow, and that course is where you learn why.',NULL,0,'{}'::jsonb),
('225b6592-4e1a-4c64-9dbc-332e2e7ec9f2','9cb6c6c1-8bc3-4991-ad5c-fc8615c90988','text','What next','# What you have built

- **Adaptive Cruise Control** with a tuned PID, as a Gradio app and in C++
- **Stability analysis** of that controller — poles, margins, and why the tuning held
- **An end-to-end planner and controller**, closing the loop
- **A PPO agent** that learned the policy rather than being handed one
- **Electronic Stability Control** in Simulink
- **LQR**, on a clean plant and then on Lane Keep Assist
- **MPC** tracking a trajectory under real actuator constraints

## The thing you actually learned

PID reacts. LQR is optimal — but only for an unconstrained linear system with no view of the future. MPC optimises over a horizon *and* respects constraints, and it costs you compute for the privilege.

Knowing which one a problem deserves, and being able to say why, is the skill. It is also, almost always, the interview question.

## What to do next

**Push the C++.** A controller you can only demonstrate in a notebook is a controller nobody will let near a vehicle. The ACC project is in C++ for a reason — build on that.

**Get your hands on a real plant.** Simulation is honest about the maths and silent about everything else: sensor noise, actuator lag, the tyre that is not the tyre in your model.

## Where to go from here

**Advanced Driver Assistance Systems (ADAS): Engineering & Development** is where these controllers become features. You can design an LQR lane-keeper; ADAS teaches you to write its requirements, argue its safety case under ISO 26262, validate it with MIL/SIL testing, and generate the embedded code. That is the path from control engineer to ADAS engineer.

**AI Bootcamp for Autonomous Driving** is the other road — if the RL module made you want to know how the learned systems actually work, rather than treating them as the opposition.

Congratulations. PID → LQR → MPC, as one framework. Exactly as promised.',NULL,0,'{}'::jsonb),
('3b2ca858-4578-4d3c-9339-d90c01878e8e','ca8b1a70-2915-479d-8248-25f1b5d87170','text','What this module covers','## Start here

Lateral dynamics, state estimation, and optimal control — the deepest module in the course.

Lecture and slides cover the bicycle model, tyre models, ABS/TCS/ESC, and state estimation with Kalman, EKF and particle filters. Then:

- **Project 5 — Electronic Stability Control in Simulink**
- **Project 6 — Altitude control with LQR**
- **Project 7 — Lane Keep Assist with LQR**

**Why it matters:** this is where PID runs out. LQR does not tune a gain, it *solves* for the optimal one — and the step from one to the other is the step from technician to engineer.

**Next:** the final generalisation — control that plans ahead.',NULL,0,'{}'::jsonb),
('4500e16d-b812-4c15-9ac3-d6230ac71c3a','3560d351-c6bc-4557-a6fb-018339a3f085','text','What this module covers','## Start here

Everything so far you designed. This you train.

Lecture and slides, then:

- **Project 4 — RL car control with PPO in MetaDrive** — an agent that learns to drive from reward alone

**Why it matters:** put this beside the PID and planning work you have just done. One is derived, tunable and provable; the other is learned, opaque and often better. Knowing which to reach for — and being able to defend it — is the actual skill.

**Next:** the hard axis. Steering.',NULL,0,'{}'::jsonb),
('4acc9c99-2da2-4ae9-a89f-8dbb7325c4cf','3371eeb7-1255-4125-883a-62bf3c8a2041','text','What this module covers','## Start here

The end of the line: **Model Predictive Control**.

- **MPC intro** and the project explanation video
- **Project 8 — Trajectory tracking with MPC** — clone it, run it locally

**Why it matters:** PID reacts. LQR is optimal, but only for an unconstrained linear system with no view of the future. MPC optimises over a horizon *and* respects constraints — the steering limits, the acceleration limits, the road edge. It is the most capable controller here and the most expensive to run, and knowing that trade-off is the point.

**You have finished.** PID → LQR → MPC, as one framework rather than three disconnected topics — exactly as promised.',NULL,0,'{}'::jsonb),
('52932f29-a468-49e4-a146-04de18886745','717d901c-6dcc-45c0-9514-6e66ac80f4ef','text','What this module covers','## Start here

Everything the course has covered, run as an industry workflow: **Requirements → Architecture → Control → MIL/SIL validation**.

- **Requirements writing assignment**, with a worked solution — where real feature development actually begins
- **Capstone Project 11 — AEB, ACC and LKA in Simulink**, co-simulated against IPG CarMaker
- **MIL/SIL testing and code generation** — building the test harness, then generating embedded code with Embedded Coder

**Why it matters:** this is Model-Based Design as the industry practises it. The notebooks got you the algorithms; this gets you the process — and the process is what you will be hired to follow.

**Congratulations.** You have taken a feature from requirement to generated code.',NULL,0,'{}'::jsonb),
('696beb6c-95aa-42a7-9a51-739f10601be7','78cd0331-43e9-47b4-8cb8-2f4ba5ea887e','text','The Parameterized Project Guide (works for every user)','# End-to-End Project: Your Commit → Your Cluster

This guide is fully **parameterized** — set the variables below once, then every
command works for ANY user, on any machine. Nothing in this project is tied to
the instructor''s accounts.

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
from http.server import BaseHTTPRequestHandler, HTTPServer
class H(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.end_headers()
        self.wfile.write(b"pipeline works!")
HTTPServer(("0.0.0.0", 8080), H).serve_forever()
PY
cat > test_app.py <<''PY''
def test_truth():
    assert 1 + 1 == 2
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
    stage(''Test'')  { steps { sh ''python -m pytest -q'' } }
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
','Set your variables once; every command below is copy-paste.',0,'{}'::jsonb),
('6a1e6768-7065-4463-9e19-f794670e0d5c','07c8d901-3022-4cb5-8cf8-f6d5b111fdfb','text','What this module covers','## Start here

The part that separates a demo from a product.

- **Functional safety — a high-level overview** — hazard analysis, ASIL, the V-model
- **Functional safety — implementation steps** — what it actually demands of your code and your process

**Why it matters:** ISO 26262 is why ADAS engineering looks nothing like ML engineering. You cannot ship a feature because it performed well on a test set; you have to argue it is safe, and be able to show the argument. Nearly every ADAS interview goes here.

**Next:** the capstone — all of it, at once.',NULL,0,'{}'::jsonb),
('7f42d378-1796-4d9b-bd58-e4b9bc2650e0','1f54f8da-ce1c-43f5-9edc-da3effd66ad2','text','Welcome','# Welcome

You are here to build AI systems for autonomous driving, not to collect algorithms. That distinction shapes everything about how this course is arranged.

## What you will actually do

By the end you will have trained an emergency braking system that decides when to stop a car, a CNN that reads traffic signs, an RL agent that drives with no hand-written rules at all, a perception stack running on real KITTI data, and six projects on the current frontier — fine-tuned LLMs, an agentic system, a vision-language model reasoning over a driving scene, and controllable image generation.

## How it is arranged

Seven modules, and the order is the argument:

1. **Foundations** — Python, data structures, algorithms, SQL
2. **Foundations of ML** — how a machine learns anything at all
3. **Supervised ML** — the classical models, and your first real feature (AEB)
4. **Motion prediction and planning** — connecting perception to action
5. **Deep learning and RL** — when hand-written features run out
6. **Computer vision** — earning the assumption that the car can see
7. **Multimodal LLMs and generative vision** — where the field is going

Each module opens with a "What this module covers" lesson explaining why it follows the one before it. Read those. They are the thread.

## Who this is for

Engineers who can already program and want to build systems. If you are looking for a gentle introduction to AI, this is not it — Module 3 assumes you can wrangle data without being told how.

**Start with Module 1.** If you are already fluent in Python, skim it and move on — but do not skip the algorithms notebook. The pathfinding in it comes back as global planning.',NULL,0,'{}'::jsonb),
('b1bac4a5-b42a-4e0d-be33-59534b734929','9d0928d9-5b55-4a3e-b1f6-97c4a7ce426c','text','What next','# What you have built

Look back at what is now in your repository.

- An **AEB system** that brakes a car in simulation, trained from data
- A **CNN** that classifies traffic signs on a real benchmark
- A **PPO agent** that drives end to end, learned entirely from reward
- A **perception stack** — detection, tracking, segmentation, lane estimation, speed from vision — on real KITTI data
- **Six frontier projects**: a pretrained and fine-tuned LLM, efficient fine-tuning, an agentic system, a VLM reasoning over a driving scene, and controllable generation

That is not a portfolio of tutorials. It is a portfolio of systems.

## What to do next

**Put the projects somewhere public.** The PPO agent and the KITTI work are the two that make a hiring manager stop scrolling. A repository with a clear README beats a certificate every time.

**Go deeper where it caught you.** If the AEB and PPO work is what you enjoyed, you are a controls person and did not know it. If KITTI and segmentation held your attention, you are a perception person.

## Where to go from here

**Advanced Driver Assistance Systems (ADAS): Engineering & Development** is the natural next step. This course taught you the AI; ADAS teaches you how it becomes a product — functional safety, ISO 26262, requirements, the V-model, and a Simulink capstone co-simulated against IPG CarMaker. It is the difference between a model that works and a feature that ships, and it is the gap most ML engineers never cross.

**Modern Vehicle Control (PID → LQR → MPC)** is the other direction — if the RL agent made you want to know what a *provably* good controller looks like, that is the course that answers it.

Congratulations. Go and build something.',NULL,0,'{}'::jsonb),
('ca30d049-f6a3-4e05-9cca-1602ed70b232','f8cc1c01-9245-40dd-83c5-03f51d375377','text','What this module covers','## Start here

Classical ML got you a working AEB. Deep learning is what happens when the features are too complicated to write down by hand — which, for driving, they always are.

- **Deep Learning and Reinforcement Learning — Lecture** — neural networks, then policies that learn by acting
- **PyTorch: From Foundations to Deployment** — the framework, taken all the way to a deployable model
- **Traffic Sign Classification (GTSRB)** — a real CNN on a real benchmark
- **RL Actor-Critic PPO in MetaDrive** — a PPO agent that drives end to end, no hand-written planner anywhere

**Why it matters:** the PPO notebook is the first time you build something with *no explicit rules at all* — the policy is learned from reward. Sitting it directly beside the rule-based pipeline from Module 3 is the point: you should come away able to argue for either.

**Next:** Module 5 goes back to the sensor and asks what the network actually sees.',NULL,0,'{}'::jsonb),
('cb70d306-eaaf-4a8f-a5e8-3fc292b4efea','5a1f1b4f-32ff-4f2c-b13a-0064b10474f4','text','Welcome','# Welcome

This course is about how ADAS systems are actually built — not how they are described in a paper.

## What you will actually do

Eleven projects and a capstone. You will build Automatic Emergency Braking from data, classify traffic signs with a CNN, train an RL agent to drive, assemble a full three-layer planning stack (A* → FSM → lattice planner), write an Adaptive Cruise Controller in C++, and finish by building AEB, ACC and Lane Keep Assist in Simulink, co-simulated against IPG CarMaker and validated with MIL/SIL testing and generated embedded code.

## How it is arranged

Thirteen modules, following the shape of the real thing:

**Foundations** → the lab and toolchain, then the programming
**Perception** → machine learning, deep learning, reinforcement learning
**Planning** → route, behaviour, trajectory
**Implementation** → modern C++, the language it ships in
**Control** → longitudinal, then lateral vehicle dynamics
**Safety** → ISO 26262, the V-model, and why any of this is allowed on a road
**Capstone** → all of it, run as an industry workflow

Each module opens with a "What this module covers" lesson explaining why it follows the last. That thread is the course.

## Who this is for

Engineers who want to work on ADAS as it is practised, with the process and the safety case, not just the algorithms. Set up MATLAB and IPG CarMaker in Module 1 — the capstone depends on it, and you do not want to discover that in week eleven.

**Start with Module 1.**',NULL,0,'{}'::jsonb),
('dd881bf9-2e86-4bb5-b739-3cda732a9cd6','e6f6a810-e164-4e5e-934e-258acb209ac0','text','Welcome','# Welcome

Most control courses teach PID, then LQR, then MPC as three unrelated topics. They are not three topics. They are one idea, arriving in stages, and each stage exists because the previous one ran out of road.

That is the argument this course makes.

## What you will actually do

Eight projects. Adaptive Cruise Control with a tuned PID, in C++. Stability analysis of the thing you just built. An end-to-end planner feeding a controller. An RL agent that learns the policy instead of being given one. Electronic Stability Control in Simulink. LQR, twice — once on a clean plant, once steering a car in its lane. And finally MPC, tracking a trajectory while respecting the limits the vehicle actually has.

## How it is arranged

**Foundations** → Python, then modern C++ (production controllers are C++, and yours will be)
**Longitudinal dynamics** → the straight-line problem, and PID
**Planning and control** → where the trajectory comes from
**Reinforcement learning** → the learned alternative, for contrast
**Lateral dynamics** → the hard axis: tyres, yaw, state estimation, and LQR
**Model Predictive Control** → control that sees ahead

Each module opens with a "What this module covers" lesson explaining why it follows the last.

## Who this is for

Engineers who want to design controllers for real vehicles and be able to defend the design. You will need to be comfortable with linear algebra — LQR is not a black box, and the whole point is that you can see inside it.

**Start with Module 1.**',NULL,0,'{}'::jsonb);

INSERT INTO public.quizzes(id,course_id,capsule_id,title,description,quiz_type,is_graded,passing_score,max_attempts,order_index,is_published) VALUES
('45cfb241-bef5-40b1-9949-efc9aed70854','9078b1a0-fc12-4808-ad21-98ed4e94b70c','e2654ce3-3496-4267-8a4c-800acc603078','Practice Project - ML Algorithms  — Check yourself','Notebook lesson. Ask what a parameter does, what the output means, or what would change if a value were different — questions they can only answer having run it.','quiz',false,70,3,5,true),
('4ff00b53-d95b-4042-83d4-a008acdf18fd','64c67e86-4327-42e1-bef3-7841c70719d6','dde43f20-164c-47be-a89e-3e131104d6b1','ML Algorithms — Notebook — Check yourself','Notebook lesson. Ask what a parameter does, what the output means, or what would change if a value were different — questions they can only answer having run it.','quiz',false,70,3,4,true),
('a379cea8-2d19-463e-9993-5720a3cd269f','64c67e86-4327-42e1-bef3-7841c70719d6','7b9e00ce-9405-4ade-8ab2-e0897265209f','KITTI — Tracking and Detection — Check yourself','Notebook lesson. Ask what a parameter does, what the output means, or what would change if a value were different — questions they can only answer having run it.','quiz',false,70,3,3,true),
('e82ea585-3c07-454a-a13b-dcf0bbf94565','64c67e86-4327-42e1-bef3-7841c70719d6','6d783d1c-7784-4089-8bb8-a3fae4665ca0','How Machines Learn — Check yourself','Write 3–5 questions on the core idea of this lesson.','quiz',false,70,3,1,true);

INSERT INTO public.quiz_questions(id,quiz_id,question_type,question_text,options,correct_answer,explanation,points,order_index) VALUES
('00941394-9e1e-40cc-82e2-e34d63a744fb','a379cea8-2d19-463e-9993-5720a3cd269f','mcq','Detection finds objects in a frame. Tracking additionally:','{"a": "Improves accuracy", "b": "Associates the same object across frames, giving it an identity and a velocity", "c": "Segments pixels", "d": "Estimates depth"}'::jsonb,'"b"'::jsonb,'Without identity there is no velocity, and without velocity a planner cannot predict anything. Detection alone is not enough to drive.',1,0),
('03fb8f77-7cc3-4893-b0b3-e1dcddbf8c1e','4ff00b53-d95b-4042-83d4-a008acdf18fd','mcq','Why do most production ADAS features use classical ML rather than deep networks?','{"a": "They are more accurate", "b": "They are cheaper to run, easier to certify, and often enough", "c": "Deep learning does not work on cars", "d": "They need no data"}'::jsonb,'"b"'::jsonb,'Latency budgets are hard and the safety case must be arguable. "It is simpler and it passes" beats "it scored higher on the benchmark".',1,0),
('05b4dd39-bbdd-4b4b-8808-83456da18b99','e82ea585-3c07-454a-a13b-dcf0bbf94565','true_false','Most machine learning failures in production are caused by a bug in the model code.',NULL,'"false"'::jsonb,'Most are failures of the assumptions underneath — leaked labels, a train/serve skew, a distribution that shifted, a metric that did not measure what anyone cared about. The code is usually fine.',1,0),
('2b3a41bc-f53a-4635-9ecd-57e17693adbe','45cfb241-bef5-40b1-9949-efc9aed70854','mcq','Why do most production ADAS features use classical ML rather than deep networks?','{"a": "They are more accurate", "b": "They are cheaper to run, easier to certify, and often enough", "c": "Deep learning does not work on cars", "d": "They need no data"}'::jsonb,'"b"'::jsonb,'Latency budgets are hard and the safety case must be arguable. "It is simpler and it passes" beats "it scored higher on the benchmark".',1,0);

INSERT INTO public.capsule_content(id,capsule_id,content_type,title,content_value,order_index,metadata) VALUES
('70000000-0000-4000-8000-000000000001','01312645-5c8b-4f89-b67d-b8f6ae7c1055','weblink','Existing lecture reference','https://example.com/existing-lecture',999,'{"fixture": "preserve"}'::jsonb);

INSERT INTO public.quiz_attempts(id,quiz_id,user_id,score,max_score,passed,answers) VALUES
('70000000-0000-4000-8000-000000000002','45cfb241-bef5-40b1-9949-efc9aed70854','00000000-0000-0000-0000-000000000002',77,100,true,'{"historical": "preserve"}'::jsonb);

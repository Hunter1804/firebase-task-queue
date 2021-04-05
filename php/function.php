<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Google\Cloud\Tasks\V2\CloudTasksClient;
use Google\Cloud\Tasks\V2\HttpMethod;
use Google\Cloud\Tasks\V2\HttpRequest;
use Google\Cloud\Tasks\V2\Task;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Date;

class CloudTaskController extends Controller
{

    //composer require google/apiclient
    public function __construct()
    {
        // putenv('GOOGLE_APPLICATION_CREDENTIALS=../');
    }
    public function testQueue() {
        $payload['client'] =1;
        $payload['project_id'] = 1;

        $urlTask = '/auction/app/1';
        // $targetUrl = 'https://fff8a680aa9c.ngrok.io/gcloudtask'.$urlTask;
        $targetUrl = 'https://us-central1-absolute-dev01.cloudfunctions.net/auctionSetStatus';
        $projectId = Config::get('app.google.project_id','absolute-dev01');
        $queueId = Config::get('app.google.queue_id', 'auctionupdate');
        $location = Config::get('app.google.location', 'asia-northeast1');
        $inSeconds = 300;
        
        $encodePayload = json_encode($payload);

        $client = new \Google_Client();
        $client->setAuthConfigFile(storage_path('absolute-dev01-task-queue.json'));
        $client->addScope('https://www.googleapis.com/auth/cloud-platform');
        // $name = 'projects/absolute-dev01/locations/asia-northeast1/queues/auctionupdate/tasks/7981065369016174761';

        // $service = new \Google_Service_CloudTasks($client);

        // $remove = $service->projects_locations_queues_tasks->delete($name);
        // dd($remove);

        $taskClient = new \Google_Service_CloudTasks($client);

        $appEngineHttpRequest = new \Google_Service_CloudTasks_HttpRequest();
        $appEngineHttpRequest->setHttpMethod('post');
        $appEngineHttpRequest->setBody(base64_encode($encodePayload));
        $appEngineHttpRequest->setUrl($targetUrl);

        $task = new \Google_Service_CloudTasks_Task;
        $task->setHttpRequest($appEngineHttpRequest);

        if($inSeconds != null) {
            $secondeString = sprintf('+%s seconds', $inSeconds);
            $futureTime = date(\DateTime::RFC3339, strtotime($secondeString));
            // printf()
            $task->setScheduleTime($futureTime);
        }

        $createTaskRequest = new \Google_Service_CloudTasks_CreateTaskRequest();
        $createTaskRequest->setTask($task);

        $queueName = sprintf('projects/%s/locations/%s/queues/%s',$projectId, $location, $queueId);

        $reponse = $taskClient->projects_locations_queues_tasks->create($queueName, $createTaskRequest);
        dd($reponse);
    }

    public function gcloudtask(Request $request, $autionId)
    {
        \Log::debug('An informational message.'. $autionId);
        return $request->all();
        dd(1);
    }
}

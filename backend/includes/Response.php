<?php
class Response
{
    /**
     * Send a success response and stop execution.
     *
     * @param array $data    Payload merged into the response, e.g.
     *                       ['current_token' => 41, 'my_token' => 47]
     * @param int   $status  HTTP status code (default 200)
     */
    public static function success(array $data = [], int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'data'    => $data,
        ]);
        exit;
    }

    /**
     * Send an error response and stop execution.
     *
     * @param string     $message Human-readable, safe-to-show message.
     * @param int        $status  HTTP status code (default 400)
     * @param array|null $errors  Optional field-level validation errors.
     */
    public static function error(string $message, int $status = 400, ?array $errors = null): void
    {
        http_response_code($status);
        header('Content-Type: application/json');

        $body = [
            'success' => false,
            'message' => $message,
        ];

        if ($errors !== null) {
            $body['errors'] = $errors;
        }

        echo json_encode($body);
        exit;
    }
}